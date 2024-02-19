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



