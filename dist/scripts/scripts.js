angular.module('ngCacheBuster', [])
  .config(['$httpProvider', function($httpProvider) {
    return $httpProvider.interceptors.push('httpRequestInterceptorCacheBuster');
  }])
    .provider('httpRequestInterceptorCacheBuster', function() {
	
	this.matchlist = [/.*partials.*/, /.*views.*/ ];
	this.logRequests = false;
	
	//Default to whitelist (i.e. block all except matches)
	this.black=false; 
	
	//Select blacklist or whitelist, default to whitelist
	this.setMatchlist = function(list,black) {
	    this.black = typeof black != 'undefined' ? black : false
	    this.matchlist = list;
	};
	

	this.setLogRequests = function(logRequests) {
	    this.logRequests = logRequests;
	};
	
	this.$get = ['$q', '$log', function($q, $log) {
	    var matchlist = this.matchlist;
	    var logRequests = this.logRequests;
	    var black = this.black;
        if (logRequests) {
            $log.log("Blacklist? ",black);
        }
	    return {
		'request': function(config) {
		    //Blacklist by default, match with whitelist
		    var busted= !black; 
		    
		    for(var i=0; i< matchlist.length; i++){
			if(config.url.match(matchlist[i])) {
			    busted=black; break;
			}
		    }
		    
		    //Bust if the URL was on blacklist or not on whitelist
		    if (busted) {
			var d = new Date();
			config.url = config.url.replace(/[?|&]cacheBuster=\d+/,'');
			//Some url's allready have '?' attached
			config.url+=config.url.indexOf('?') === -1 ? '?' : '&'
			config.url += 'cacheBuster=' + d.getTime();
		    }
		    
		    if (logRequests) {
			var log='request.url =' + config.url
			busted ? $log.warn(log) : $log.info(log)
		    }

		    return config || $q.when(config);
		}
	    }
	}];
    });



var app = angular.module('DrizlyApp', [
    'ui.sortable', 
    'ngRoute',
    'ngCacheBuster'
    ]);

app.constant('URL', 'data/');

app.filter('render', function () {
  return function (value) {
    return value;
  };
});

// To Use 
// {{ content.link | render | trustAsHtml }}
app.filter('trustAsHtml', function ($sce) {
  return function (value) {
    return $sce.trustAsHtml(value);
  };
});


app.config(function(httpRequestInterceptorCacheBusterProvider){
    httpRequestInterceptorCacheBusterProvider.setMatchlist([/.*css.*/,/.*scripts.*/,/.*data.*/],true);
});

app.config(function ($sceDelegateProvider) {
    $sceDelegateProvider.resourceUrlWhitelist(['self', '**']);
});

app.config( function($routeProvider, $locationProvider) {
  $routeProvider
  .when('/', {
    controller: 'templateController',
    templateUrl: 'partials/view1.html'
  })
  .otherwise({ redirectTo: '/'});

  // use the HTML5 History API
  $locationProvider.html5Mode(true);

});

app.service('Project', function () {
    this.current = 0;
});

app.factory('DataService', function ($http, URL) {
    var getData = function () {
        return $http.get(URL + 'emails.json');
    };

    var saveData = function (data) {
      $http.post('scripts/saveJSON.php', data).
      success( function () {
        alert('Success, List Saved');
      }).
      error( function (err) {
        alert('Failed: ' + err);
      });
    }

    return {
        getData: getData,
        saveData: saveData
    };
});

app.factory('TemplateService', function ($http, URL) {
    var getTemplates = function () {
        return $http.get(URL + 'templates.json');
    };

    return {
        getTemplates: getTemplates
    };
});

app.controller('templateController', function (DataService, TemplateService, $sce, Project) {
    var ctrl = this;
    ctrl.content = [];

    ctrl.fetchContent = function () {
        DataService.getData().then(function (result) {
            ctrl.content = result.data;
        });
    };

    ctrl.fetchTemplates = function () {
        TemplateService.getTemplates().then(function (result) {
            ctrl.tpl = result.data;
        });
    };

    ctrl.currentProject = Project.current;
    ctrl.fetchContent();
    ctrl.fetchTemplates();

    // Load Project
    ctrl.loadProject = function (project) {
        var index = ctrl.content.indexOf(project);
        Project.current = index;
        ctrl.currentProject = index;
        $('.main').toggleClass('hide-projects');
    }

    // Open Projects
    ctrl.openProjects = function () {
        $('.main').toggleClass('hide-projects');
    }

    // Add Projects
    ctrl.addProject = function (newProject) {
        ctrl.content.push({
            name: newProject.name,
            subject: newProject.subject,
            locked: 0,
            blocks: []
        });
    }

    // Save Content
    ctrl.saveContent = function () {
      DataService.saveData(ctrl.content);
    }

    // Remove Projects
    ctrl.removeProject = function(project) {
      var index = ctrl.content.indexOf(project);
      if (project.locked == 0) {    
        if (confirm('Are you sure you want to delete this project?')) {
            ctrl.content.splice(index, 1);
        } else {
            // Do nothing!
        }
      } else {
        alert('Cannot delete project');
      }
    };

    // Copy Content
    ctrl.copyContent = function (project) {
        if (confirm('Are you sure you want to copy this project?')) {
            var index = ctrl.content.indexOf(project);
            var duplicate = angular.copy(ctrl.content[index]);
            var newProject = {};
            // change array slightly
            newProject.name = duplicate.name + ' Copy';
            newProject.locked = 0;
            newProject.subject = duplicate.subject;
            newProject.tracking = duplicate.tracking;
            newProject.blocks = duplicate.blocks;
            ctrl.content.push(newProject)
        } else {
            // Do nothing!
        }
    }

    // Export
    ctrl.export = function() {
        // Create Email
        ctrl.html = ctrl.tpl.htmlTop;
        $('.block-list .block').each(function (index) {
            ctrl.html += $(this).html();
        })
        ctrl.html += ctrl.tpl.htmlBottom; 
    
        // Place into modal window
        $('.exportContents textarea').val(ctrl.html);

        $('.exportContents').dialog({
           buttons: {
              OK: function() {$(this).dialog("close");}
           },
           title: "Email HTML",
           width: 600,
           height: 400,
           position: {
              my: "center center",
              at: "center center"
           }
        });

    }

    // Add Block
    ctrl.addTemplate = function (template) {
        var blockcount = ctrl.content[Project.current].blocks.length;
        ctrl.content[Project.current].blocks.push({
            block_id: blockcount + 1,
            block_type: template
        });
    }

});

app.directive('block', function ($compile, TemplateService) {

    var getTemplate = function (templates, contentType) {
        var template = {};

        switch (contentType) {
            case 'header':
                template = templates.header;
                break;
            case 'featureImage':
                template = templates.featureImage;
                break;
            case 'featureMessage':
                template = templates.featureMessage;
                break;
            case 'gridThree':
                template = templates.gridThree;
                break;
            case 'productTwo':
                template = templates.productTwo;
                break;
            case 'productThree':
                template = templates.productThree;
                break;
            case 'imageText':
                template = templates.imageText;
                break;
            case 'textImage':
                template = templates.textImage;
                break;
            case 'imageTextRed':
                template = templates.imageTextRed;
                break;
            case 'textImageRed':
                template = templates.textImageRed;
                break;
            case 'imageTextGrey':
                template = templates.imageTextGrey;
                break;
            case 'textImageGrey':
                template = templates.textImageGrey;
                break;
            case 'splitImage':
                template = templates.splitImage;
                break;
            case 'spacer':
                template = templates.spacer;
                break;
            case 'footer':
                template = templates.footer;
                break;
        }

        return template;
    };

    var linker = function (scope, element, attrs ) {

        TemplateService.getTemplates().then(function (response) {
            var templates = response.data;
            element.html(getTemplate(templates, scope.content.block_type));
            $(element).append('<div class="block-toggle"><a data-ng-click="onRemove()" class="btn-trash-block icon-close"></a></div>');
            $compile(element.contents())(scope);
        });

    };

    return {
        restrict: 'EA',
        replace: true,
        template: '<li></li>',
        link: linker,
        scope: {
            content: '=',
            onRemove:"&"
        }
    };
});


app.directive('edit', function ($compile, TemplateService) {

    var getTemplate = function (templates, contentType) {
        var template = '';

        // Move these definitions into individual files. and include them. 

        switch (contentType) {
            case 'header':
                template = '<a class="toggle" data-ng-click="open($event)">Header</a><div class="accordion-body"><label>Tracking Code<br><input type="text" data-ng-model="content.tracking" /></label><br><label>Button URL (Do Not Include Tracking)<br><input type="text" data-ng-model="content.btnurl" /></label><br><label>Button Text<br><input type="text" data-ng-model="content.btntext" /></div>';
                break;
            case 'featureImage':
                template = '<a class="toggle" data-ng-click="open($event)">Feature Image</a><div class="accordion-body"><label>Image - 580x250<br><input type="text" data-ng-model="content.image" /></label><br><label>URL<br> <input type="text" data-ng-model="content.link" /></label><br><label>Alt Text<br> <input type="text" data-ng-model="content.alt" /></label></div>';
                break;
            case 'featureMessage':
                template = '<a class="toggle" data-ng-click="open($event)">Feature Message</a><div class="accordion-body"><label>Headline<br><input type="text" data-ng-model="content.headline" /></label><br><label>Message<br> <textarea rows="8" type="text" data-ng-model="content.text" /></textarea></label></div>';
                break;
            case 'gridThree':
                template = '<a class="toggle" data-ng-click="open($event)">Grid Three</a><div class="accordion-body"> <a class="toggle" data-ng-click="open($event)">Image 1</a> <div class="accordion-body one"> <label>Image 1 - 272x376 <br> <input data-ng-model="content.image1" type="text" /> </label> <br> <label>URL 1 <br> <input data-ng-model="content.link1" type="text" /> </label> <br> </div> <a class="toggle" data-ng-click="open($event)">Image 2</a> <div class="accordion-body two"> <label>Image 2 - 272x178 <br> <input data-ng-model="content.image2" type="text" /> </label> <br> <label>URL 2 <br> <input data-ng-model="content.link2" type="text" /> </label> <br> </div> <a class="toggle" data-ng-click="open($event)">Image 3</a> <div class="accordion-body three"> <label>Image 3 - 272x178 <br> <input data-ng-model="content.image3" type="text" /> </label> <br> <label>URL 3 <br> <input data-ng-model="content.link3" type="text" /> </label> <br> </div></div>';
                break;
            case 'productTwo':
                template = '<a class="toggle" data-ng-click="open($event)">Product Two</a><div class="accordion-body"> <a class="toggle" data-ng-click="open($event)">Product 1</a> <div class="accordion-body one"> <label>Image 1 - 150x225 <br> <input data-ng-model="content.image1" type="text" /> </label> <br> <label>URL 1 <br> <input data-ng-model="content.link1" type="text" /> </label> <br> <label>Line 1 <br> <input data-ng-model="content.texttop1" type="text" /> </label> <br> <label>Line 2 <br> <input data-ng-model="content.textbottom1" type="text" /> </label> <br> <label>Price <br> <input data-ng-model="content.price1" type="text" /> </label> <br> <label>Button Text <br> <input data-ng-model="content.buttontext1" type="text" /> </label> <br> </div> <a class="toggle" data-ng-click="open($event)">Product 2</a> <div class="accordion-body two"> <label>Image 2 - 150x225 <br> <input data-ng-model="content.image2" type="text" /> </label> <br> <label>URL 2 <br> <input data-ng-model="content.link2" type="text" /> </label> <br> <label>Line 1 <br> <input data-ng-model="content.texttop2" type="text" /> </label> <br> <label>Line 2 <br> <input data-ng-model="content.textbottom2" type="text" /> </label> <br> <label>Price <br> <input data-ng-model="content.price2" type="text" /> </label> <br> <label>Button Text <br> <input data-ng-model="content.buttontext2" type="text" /> </label> <br> </div></div>';
                break;
            case 'productThree':
                template = '<a class="toggle" data-ng-click="open($event)">Product Three</a><div class="accordion-body"><a class="toggle" data-ng-click="open($event)">Product 1</a><div class="accordion-body one"><label>Image 1 - 150x225<br> <input data-ng-model="content.image1" type="text" /></label><br><label>URL 1<br> <input data-ng-model="content.link1" type="text" /></label><br><label>Line 1<br> <input data-ng-model="content.texttop1" type="text" /></label><br><label>Line 2<br> <input data-ng-model="content.textbottom1" type="text" /></label><br><label>Price<br> <input data-ng-model="content.price1" type="text" /></label><br><label>Button Text<br> <input data-ng-model="content.buttontext1" type="text" /></label><br></div><a class="toggle" data-ng-click="open($event)">Product 2</a><div class="accordion-body two"><label>Image 2 - 150x225<br> <input data-ng-model="content.image2" type="text" /></label><br><label>URL 2<br> <input data-ng-model="content.link2" type="text" /></label><br><label>Line 1<br> <input data-ng-model="content.texttop2" type="text" /></label><br><label>Line 2<br> <input data-ng-model="content.textbottom2" type="text" /></label><br><label>Price<br> <input data-ng-model="content.price2" type="text" /></label><br><label>Button Text<br> <input data-ng-model="content.buttontext2" type="text" /></label><br></div><a class="toggle" data-ng-click="open($event)">Product 3</a><div class="accordion-body three"><label>Image 3 - 150x225<br> <input data-ng-model="content.image3" type="text" /></label><br><label>URL 3<br> <input data-ng-model="content.link3" type="text" /></label><br><label>Line 1<br> <input data-ng-model="content.texttop3" type="text" /></label><br><label>Line 2<br> <input data-ng-model="content.textbottom3" type="text" /></label><br><label>Price<br> <input data-ng-model="content.price3" type="text" /></label><br><label>Button Text<br> <input data-ng-model="content.buttontext3" type="text" /></label><br></div></div>';
                break;
            case 'imageText':
                template = '<a class="toggle" data-ng-click="open($event)">Image Text</a><div class="accordion-body"><label>Image - 116x116<br><input type="text" data-ng-model="content.image" /></label><br><label>URL<br> <input type="text" data-ng-model="content.link" /><br><label>Headline<br> <input type="text" data-ng-model="content.headline" /></label><br><label>Message<br> <input type="text" data-ng-model="content.text" /></label></div>';
                break;
            case 'textImage':
                template = '<a class="toggle" data-ng-click="open($event)">Text Image</a><div class="accordion-body">Headline<br> <input type="text" data-ng-model="content.headline" /></label><br><label>Message<br> <input type="text" data-ng-model="content.text" /></label><br><label>Image - 472x396<br><input type="text" data-ng-model="content.image" /></label><br><label>URL<br> <input type="text" data-ng-model="content.link" /><label></div>';
                break;
            case 'imageTextRed':
                template = '<a class="toggle" data-ng-click="open($event)">Image Text "Red"</a><div class="accordion-body"><label>Image- 472x396<br><input type="text" data-ng-model="content.image" /></label><br><label>URL<br> <input type="text" data-ng-model="content.link" /><br><label>Headline<br> <input type="text" data-ng-model="content.headline" /></label><br><label>Message<br> <input type="text" data-ng-model="content.text" /></label></div>';
                break;
            case 'textImageRed':
                template = '<a class="toggle" data-ng-click="open($event)">Text Image "Red"</a><div class="accordion-body"><label>Image- 472x396<br><input type="text" data-ng-model="content.image" /></label><br><label>URL<br> <input type="text" data-ng-model="content.link" /><br><label>Headline<br> <input type="text" data-ng-model="content.headline" /></label><br><label>Message<br> <input type="text" data-ng-model="content.text" /></label></div>';
                break;
            case 'imageTextGrey':
                template = '<a class="toggle" data-ng-click="open($event)">Image Text "Grey"</a><div class="accordion-body"><label>Image- 472x396<br><input type="text" data-ng-model="content.image" /></label><br><label>URL<br> <input type="text" data-ng-model="content.link" /><br><label>Headline<br> <input type="text" data-ng-model="content.headline" /></label><br><label>Message<br> <input type="text" data-ng-model="content.text" /></label></div>';
                break;
            case 'textImageGrey':
                template = '<a class="toggle" data-ng-click="open($event)">Text Image "Grey"</a><div class="accordion-body"><label>Image- 472x396<br><input type="text" data-ng-model="content.image" /></label><br><label>URL<br> <input type="text" data-ng-model="content.link" /><br><label>Headline<br> <input type="text" data-ng-model="content.headline" /></label><br><label>Message<br> <input type="text" data-ng-model="content.text" /></label></div>';
                break;
            case 'splitImage':
                template = '<a class="toggle" data-ng-click="open($event)">Split Image</a><div class="accordion-body"> <a class="toggle" data-ng-click="open($event)">Image 1</a><div class="accordion-body"> <label>Left Image - 472x314 <br> <input type="text" data-ng-model="content.image1" /> <label>Left URL <br> <input type="text" data-ng-model="content.link1" /></div><a class="toggle" data-ng-click="open($event)">Image 2</a><div class="accordion-body"> <label>Right Image - 472x314 <br> <input type="text" data-ng-model="content.image2" /> <label>Right URL <br> <input type="text" data-ng-model="content.link2" /></div></div>';
                break;
            case 'spacer':
                template = '<a class="toggle" data-ng-click="open($event)">Horz. Spacer</a><div class="accordion-body"><label>Spacer Height (use px)<br><input type="text" data-ng-model="content.height" /></div>';
                break;
            case 'footer':
                template = '<a class="toggle" data-ng-click="open($event)">Footer</a><div class="accordion-body"><label>Tracking Code<br><input type="text" data-ng-model="content.tracking" /></div>';
                break;
        }

        return template;
    };

    var linker = function (scope, element, attrs) {

        TemplateService.getTemplates().then(function (response) {
            var templates = response.data;
            element.html(getTemplate(templates, scope.content.block_type ));
            $compile(element.contents())(scope);
        });

        scope.open = function($event) {
              
            var $this = $event.currentTarget;
            var sibling = $this.nextSibling;

            if(hasClass(sibling, 'show')) {
                sibling.className = sibling.className.replace( /(?:^|\s)show(?!\S)/g , '' );
            } else {
                sibling.className += " show";
            }

            function hasClass(element, cls) {
                return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
            }

        };


    };

    return {
        restrict: 'EA',
        replace: true,
        link: linker,
        template: '<li></li>',
        scope: {
            content: '='
        }
    };
});




/*
jQuery UI Sortable plugin wrapper

@param [ui-sortable] {object} Options to pass to $.fn.sortable() merged onto ui.config
*/
angular.module('ui.sortable', [])
.value('uiSortableConfig',{})
.directive('uiSortable', [
  'uiSortableConfig', '$timeout', '$log',
  function(uiSortableConfig, $timeout, $log) {
    return {
      require: '?ngModel',
      scope: {
        ngModel: '=',
        uiSortable: '='
      },
      link: function(scope, element, attrs, ngModel) {
        var savedNodes;

        function combineCallbacks(first,second){
          if(second && (typeof second === 'function')) {
            return function() {
              first.apply(this, arguments);
              second.apply(this, arguments);
            };
          }
          return first;
        }

        function getSortableWidgetInstance(element) {
          // this is a fix to support jquery-ui prior to v1.11.x
          // otherwise we should be using `element.sortable('instance')`
          var data = element.data('ui-sortable');
          if (data && typeof data === 'object' && data.widgetFullName === 'ui-sortable') {
            return data;
          }
          return null;
        }

        function hasSortingHelper (element, ui) {
          var helperOption = element.sortable('option','helper');
          return helperOption === 'clone' || (typeof helperOption === 'function' && ui.item.sortable.isCustomHelperUsed());
        }

        // thanks jquery-ui
        function isFloating (item) {
          return (/left|right/).test(item.css('float')) || (/inline|table-cell/).test(item.css('display'));
        }

        function getElementScope(elementScopes, element) {
          var result = null;
          for (var i = 0; i < elementScopes.length; i++) {
            var x = elementScopes[i];
            if (x.element[0] === element[0]) {
              result = x.scope;
              break;
            }
          }
          return result;
        }

        function afterStop(e, ui) {
          ui.item.sortable._destroy();
        }

        var opts = {};

        // directive specific options
        var directiveOpts = {
          'ui-floating': undefined
        };

        var callbacks = {
          receive: null,
          remove:null,
          start:null,
          stop:null,
          update:null
        };

        var wrappers = {
          helper: null
        };

        angular.extend(opts, directiveOpts, uiSortableConfig, scope.uiSortable);

        if (!angular.element.fn || !angular.element.fn.jquery) {
          $log.error('ui.sortable: jQuery should be included before AngularJS!');
          return;
        }

        if (ngModel) {

          // When we add or remove elements, we need the sortable to 'refresh'
          // so it can find the new/removed elements.
          scope.$watch('ngModel.length', function() {
            // Timeout to let ng-repeat modify the DOM
            $timeout(function() {
              // ensure that the jquery-ui-sortable widget instance
              // is still bound to the directive's element
              if (!!getSortableWidgetInstance(element)) {
                element.sortable('refresh');
              }
            }, 0, false);
          });

          callbacks.start = function(e, ui) {
            if (opts['ui-floating'] === 'auto') {
              // since the drag has started, the element will be
              // absolutely positioned, so we check its siblings
              var siblings = ui.item.siblings();
              var sortableWidgetInstance = getSortableWidgetInstance(angular.element(e.target));
              sortableWidgetInstance.floating = isFloating(siblings);
            }

            // Save the starting position of dragged item
            ui.item.sortable = {
              model: ngModel.$modelValue[ui.item.index()],
              index: ui.item.index(),
              source: ui.item.parent(),
              sourceModel: ngModel.$modelValue,
              cancel: function () {
                ui.item.sortable._isCanceled = true;
              },
              isCanceled: function () {
                return ui.item.sortable._isCanceled;
              },
              isCustomHelperUsed: function () {
                return !!ui.item.sortable._isCustomHelperUsed;
              },
              _isCanceled: false,
              _isCustomHelperUsed: ui.item.sortable._isCustomHelperUsed,
              _destroy: function () {
                angular.forEach(ui.item.sortable, function(value, key) {
                  ui.item.sortable[key] = undefined;
                });
              }
            };
          };

          callbacks.activate = function(e, ui) {
            // We need to make a copy of the current element's contents so
            // we can restore it after sortable has messed it up.
            // This is inside activate (instead of start) in order to save
            // both lists when dragging between connected lists.
            savedNodes = element.contents();

            // If this list has a placeholder (the connected lists won't),
            // don't inlcude it in saved nodes.
            var placeholder = element.sortable('option','placeholder');

            // placeholder.element will be a function if the placeholder, has
            // been created (placeholder will be an object).  If it hasn't
            // been created, either placeholder will be false if no
            // placeholder class was given or placeholder.element will be
            // undefined if a class was given (placeholder will be a string)
            if (placeholder && placeholder.element && typeof placeholder.element === 'function') {
              var phElement = placeholder.element();
              // workaround for jquery ui 1.9.x,
              // not returning jquery collection
              phElement = angular.element(phElement);

              // exact match with the placeholder's class attribute to handle
              // the case that multiple connected sortables exist and
              // the placehoilder option equals the class of sortable items
              var excludes = element.find('[class="' + phElement.attr('class') + '"]:not([ng-repeat], [data-ng-repeat])');

              savedNodes = savedNodes.not(excludes);
            }

            // save the directive's scope so that it is accessible from ui.item.sortable
            var connectedSortables = ui.item.sortable._connectedSortables || [];

            connectedSortables.push({
              element: element,
              scope: scope
            });

            ui.item.sortable._connectedSortables = connectedSortables;
          };

          callbacks.update = function(e, ui) {
            // Save current drop position but only if this is not a second
            // update that happens when moving between lists because then
            // the value will be overwritten with the old value
            if(!ui.item.sortable.received) {
              ui.item.sortable.dropindex = ui.item.index();
              var droptarget = ui.item.parent();
              ui.item.sortable.droptarget = droptarget;

              var droptargetScope = getElementScope(ui.item.sortable._connectedSortables, droptarget);
              ui.item.sortable.droptargetModel = droptargetScope.ngModel;

              // Cancel the sort (let ng-repeat do the sort for us)
              // Don't cancel if this is the received list because it has
              // already been canceled in the other list, and trying to cancel
              // here will mess up the DOM.
              element.sortable('cancel');
            }

            // Put the nodes back exactly the way they started (this is very
            // important because ng-repeat uses comment elements to delineate
            // the start and stop of repeat sections and sortable doesn't
            // respect their order (even if we cancel, the order of the
            // comments are still messed up).
            if (hasSortingHelper(element, ui) && !ui.item.sortable.received &&
                element.sortable( 'option', 'appendTo' ) === 'parent') {
              // restore all the savedNodes except .ui-sortable-helper element
              // (which is placed last). That way it will be garbage collected.
              savedNodes = savedNodes.not(savedNodes.last());
            }
            savedNodes.appendTo(element);

            // If this is the target connected list then
            // it's safe to clear the restored nodes since:
            // update is currently running and
            // stop is not called for the target list.
            if(ui.item.sortable.received) {
              savedNodes = null;
            }

            // If received is true (an item was dropped in from another list)
            // then we add the new item to this list otherwise wait until the
            // stop event where we will know if it was a sort or item was
            // moved here from another list
            if(ui.item.sortable.received && !ui.item.sortable.isCanceled()) {
              scope.$apply(function () {
                ngModel.$modelValue.splice(ui.item.sortable.dropindex, 0,
                                           ui.item.sortable.moved);
              });
            }
          };

          callbacks.stop = function(e, ui) {
            // If the received flag hasn't be set on the item, this is a
            // normal sort, if dropindex is set, the item was moved, so move
            // the items in the list.
            if(!ui.item.sortable.received &&
               ('dropindex' in ui.item.sortable) &&
               !ui.item.sortable.isCanceled()) {

              scope.$apply(function () {
                ngModel.$modelValue.splice(
                  ui.item.sortable.dropindex, 0,
                  ngModel.$modelValue.splice(ui.item.sortable.index, 1)[0]);
              });
            } else {
              // if the item was not moved, then restore the elements
              // so that the ngRepeat's comment are correct.
              if ((!('dropindex' in ui.item.sortable) || ui.item.sortable.isCanceled()) &&
                  !hasSortingHelper(element, ui)) {
                savedNodes.appendTo(element);
              }
            }

            // It's now safe to clear the savedNodes
            // since stop is the last callback.
            savedNodes = null;
          };

          callbacks.receive = function(e, ui) {
            // An item was dropped here from another list, set a flag on the
            // item.
            ui.item.sortable.received = true;
          };

          callbacks.remove = function(e, ui) {
            // Workaround for a problem observed in nested connected lists.
            // There should be an 'update' event before 'remove' when moving
            // elements. If the event did not fire, cancel sorting.
            if (!('dropindex' in ui.item.sortable)) {
              element.sortable('cancel');
              ui.item.sortable.cancel();
            }

            // Remove the item from this list's model and copy data into item,
            // so the next list can retrive it
            if (!ui.item.sortable.isCanceled()) {
              scope.$apply(function () {
                ui.item.sortable.moved = ngModel.$modelValue.splice(
                  ui.item.sortable.index, 1)[0];
              });
            }
          };

          wrappers.helper = function (inner) {
            if (inner && typeof inner === 'function') {
              return function (e, item) {
                var innerResult = inner.apply(this, arguments);
                item.sortable._isCustomHelperUsed = item !== innerResult;
                return innerResult;
              };
            }
            return inner;
          };

          scope.$watch('uiSortable', function(newVal /*, oldVal*/) {
            // ensure that the jquery-ui-sortable widget instance
            // is still bound to the directive's element
            var sortableWidgetInstance = getSortableWidgetInstance(element);
            if (!!sortableWidgetInstance) {
              angular.forEach(newVal, function(value, key) {
                // if it's a custom option of the directive,
                // handle it approprietly
                if (key in directiveOpts) {
                  if (key === 'ui-floating' && (value === false || value === true)) {
                    sortableWidgetInstance.floating = value;
                  }

                  opts[key] = value;
                  return;
                }

                if (callbacks[key]) {
                  if( key === 'stop' ){
                    // call apply after stop
                    value = combineCallbacks(
                      value, function() { scope.$apply(); });

                    value = combineCallbacks(value, afterStop);
                  }
                  // wrap the callback
                  value = combineCallbacks(callbacks[key], value);
                } else if (wrappers[key]) {
                  value = wrappers[key](value);
                }

                opts[key] = value;
                element.sortable('option', key, value);
              });
            }
          }, true);

          angular.forEach(callbacks, function(value, key) {
            opts[key] = combineCallbacks(value, opts[key]);
            if( key === 'stop' ){
              opts[key] = combineCallbacks(opts[key], afterStop);
            }
          });

        } else {
          $log.info('ui.sortable: ngModel not provided!', element);
        }

        // Create sortable
        element.sortable(opts);
      }
    };
  }
]);