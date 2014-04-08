$(function() {
  $('body')
  .on('click', '.facebook', function() {
    Meteor.loginWithFacebook({'requestPermissions' : ['basic_info','read_friendlists']});
  })
  .on('click', '.logout', function() {
    Meteor.logout();
  });
  ;
});

var friends      = []
  , friendIds    = []
  , friendDep    = new Deps.Dependency()
  , friendChange =
      _.debounce(function() { friendDep.changed(); }, 2000)
  , getData      =
      function(url) {
        $.getJSON(url, function(data) {
          var moreFriend = data.data
            , paging     = data.paging
            ;
          if (moreFriend && moreFriend.length) {
            friends = friends.concat(moreFriend);
            friendIds = _.pluck(friends, 'id');
            friendChange();
          }
          if (paging && paging.next) {
            getData(paging.next);
          }
        });
      }
  , userFB
  ;
//登入執行
Deps.autorun(function() {
  var userId = Meteor.userId()
    , token
    ;
  if (userId) {
    $(function() {
      $('#top').find('span.facebook').empty().html('登出').addClass('logout').removeClass('facebook');
    });
    Meteor.subscribe('myData');
    Meteor.call('getFB', userId, function(err, result) {
      if (err) {
        console.log(err);
        return false;
      }
      userFB = result[0];
      getData('https://graph.facebook.com/me/friends?access_token=' + result[1]);
    });
  }
  else {
    $('#top').find('span.logout').empty().html('<img src="facebook.png" alt="以Facebook登入" title="以Facebook登入" />').removeClass('logout').addClass('facebook');
  }
});

var dateDep   = new Deps.Dependency()
  , dateList  = []
  , padding   =
      _.memoize(function(n) {
        var result = n + '';
        if (result.length < 2) {
          return '0' + result;
        }
        else {
          return result;
        }
      });
  ;
//選擇日期後重新計算日期陣列
Deps.autorun(function() {
  dateDep.depend();
  var $date = $('#filter input.date')
    , dateFrom
    , dateTo
    , days
    , i
    , temp
    ;
  if ($date.length) {
    dateFrom = $date.filter('.dateFrom').datepicker('getDate');
    dateTo   = $date.filter('.dateTo').datepicker('getDate');
    days     = (dateTo.getTime() - dateFrom.getTime()) / 86400000 + 1; 
  }
  else {
    dateFrom = new Date();
    dateTo   = new Date(dateFrom.getTime() + 86400000 * 6);
    days     = 6;
  }
  dateList = [];
  for (i = 0; i < days; i += 1) {
    temp = new Date(dateFrom.getTime() + 86400000 * i);
    dateList.push(
      {'year'  : temp.getFullYear() + ''
      ,'month' : padding(temp.getMonth() + 1)
      ,'date'  : padding(temp.getDate())
      }
    );
  }
});
//訂閱
Counts = new Meteor.Collection('counts');
Arrangement = new Meteor.Collection('arrangement');
Deps.autorun(function() {
  dateDep.depend();
  friendDep.depend();
  var user = Meteor.userId();
  if (friendIds.length < 1) {
    return false;
  }
  var time = [];
  _.each(dateList, function(date) {
    var i;
    for (i = 0; i <= 23; i += 1) {
      time.push(date.year + date.month + date.date + padding(i));
    }
  });
  Meteor.subscribe('arrangement', time, friendIds);
});

//date picker
Template.filter.rendered =
    function() {
      var $dateFrom = $(this.find('input.dateFrom'))
        , $dateTo   = $(this.find('input.dateTo'))
        ;

      $dateFrom
      .datepicker(
        {'dateFormat'  : 'yy/mm/dd'
        ,'changeYear'  : false
        ,'onSelect'    :
            function(d, e) {
              var selected = new Date(e.selectedYear, e.selectedMonth, e.selectedDay);
              $dateTo.datepicker('setDate', new Date(selected.getTime() + 86400000 * 6));
              dateDep.changed();
            }
        }
      )
      .datepicker('setDate', '+0d');

      $dateTo
      .datepicker({'dateFormat'  : 'yy/mm/dd', 'disabled' : true})
      .datepicker('setDate', 6);
      dateDep.changed();
    }

Template.table.helpers(
  {'days'     :
      function() {
        dateDep.depend();
        return dateList;
      }
  ,'hours'    :
      _.memoize(function() {
        var result = []
          , i
          ;
        for (i = 0; i < 24; i += 1) {
          result.push(padding(i));
        }
        return result;
      })
  ,'dayhours' :
      function(hour) {
        dateDep.depend();
        var result = [];
        _.each(dateList, function(d) {
          var hourData =
              {'year'  : d.year
              ,'month' : d.month
              ,'date'  : d.date
              ,'hour'  : hour
              ,'full'  : d.year + d.month + d.date + hour
              }
          result.push(hourData);
        });
        return result;
      }
  }
)
Template.table.rendered =
    function() {
      //防拖曳
      $(window).off('selectstart').on('selectstart', function(event) { event.preventDefault(); });
      $('body').on('mouseup', function() { dragStart = false; });
    }

var dragStart = false;
Template.dateData.helpers(
  {'useClass'    :
      function() {
        var result = ['td_warp']
          , count  = Arrangement.find({'time' : this.full}).count()
          , isIGo  = Arrangement.findOne({'time' : this.full, 'user' : userFB})
          ;

        if (count > 0) {
          result.push('haveFriend');
        }
        if (isIGo) {
          result.push('go');
        }
        else {
          result.push('notgo');
        }
        return result.join(' ');
      }
  ,'count'       :
      function() {
        var result = Counts.findOne(this.full);
        return result ? result.count : 0;
        //return Arrangement.find({'time' : this.full}).count();
      }
  ,'goId'        :
      function() {
        var go = Arrangement.findOne({'time' : this.full, 'user' : userFB});
        return (go ? go._id : '');
      }
  ,'friendGo'    :
      function() {
        friendDep.depend();
        var result = [];
        Arrangement.find({'time' : this.full, 'user' : {'$in' : friendIds} }).forEach(function(d) {
          result.push(_.findWhere(friends, {'id' : d.user}));
        });
        return result;
      }
  }
)
Template.dateData.events(
  {'click div.notgo div.overlay' :
      function(e, ins) {
        if (! userFB) {
          alert('請先登入!');
          return false;
        }
        var time = ins.data.full
          , data
          ;
        Arrangement.insert({'time' : time}, function(err) {
          if (err) {
            return false;
          }
          data = time.substr(0, 8) + '_' + time.substr(8, 2) + '_Add';
          Meteor.call('encrypt', data, function(err, result) {
            $.getJSON('http://st-lytw.azurewebsites.net/api/checkindata/?callback=?', {'data' : '8a1456bf0c16a00d0da06d47035bf1a17d34a12b5f1a76088f4857c878f0bb6c'}
                     ,function(result) {
                        console.log('ajax result:', result);
                      }
                     );
          });
        });
      }
  ,'click div.go div.overlay'  :
      function(e, ins) {
        var _id  = $(e.currentTarget).attr('data-id')
          , time = ins.data.full
          ;
        Arrangement.remove( _id, function(err) {
          if (err) {
            return false;
          }
          var data = time.substr(0, 8) + '_' + time.substr(8, 2) + '_Del';
          Meteor.call('encrypt', data, function(err, result) {
            $.getJSON('http://st-lytw.azurewebsites.net/api/checkindata/?callback=?', {'data' : '8a1456bf0c16a00d0da06d47035bf1a17d34a12b5f1a76088f4857c878f0bb6c'}
                     ,function(result) {
                        console.log('ajax result:', result);
                      }
                     );
          });
        });
      }
  ,'click span.icon'    :
      function(e, ins) {
        $(ins.find('div.friends')).toggle();
      }
  }
)
Template.dateData.rendered =
    function() {
      var $this    = $(this.find('div.td_warp'))
        , $overlay = $this.find('div.overlay')
        , $friend  = $this.find('div.friends')
        , pos      = $this.closest('td').position()
        ;
      $friend.css({'left' : pos.left, 'top' : pos.top + 90});
      $this.hover(
        function() {
          $overlay.show();
        }
      , function() {
          $overlay.hide();
        }
      );
    }

//auto disconnect
var AutoDisconnect =
        _.debounce(function() {
          Meteor.disconnect();
        }, 60000);
$(function() {
  $('body').on('mouseover', function() {
    if (Meteor.status().status === 'connected') {
      AutoDisconnect();
    }
    else if (Meteor.status().status === 'offline') {
      Meteor.reconnect();
    }
  });
});
Deps.autorun(function() {
  if (Meteor.status().status === 'connected') {
    AutoDisconnect();
  }
});
