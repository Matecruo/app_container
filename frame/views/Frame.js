
var F = {
  error:function(code,event){
    var codeToMeans = [
      '初始化失败',
      '我也不知道是什么错误~~',
    ];
    if( code > 0 ){
      console.log( codeToMeans[code] + ' => ' + event );
    }
  },
  addComponent:function(name,obj,toWhere){
    toWhere || (toWhere = this);

    obj.__proto__ = toWhere;
    toWhere[name] = obj;
    obj.__type = 'component';
    if(obj.hasOwnProperty('init') && typeof obj.init === 'function'){
      obj.init();
    }
  },

  isComponent:function(obj){
    return obj.__type === 'component';
  }
};

//Loader
F.addComponent('Loader',{
  multiAsyncLoader:new MultiAsyncLoader,
  debug:false,

  //dom
  $controllerCss:document.querySelector('#_cssContainer_ ._controller_'),
  $actionCss:document.querySelector('#_cssContainer_ ._action_'),
  $customCss:document.querySelector('#_cssContainer_ ._custom_'),

  //js cache
  controllersCache:{},//obj array js
  customJsCache:{},//obj array还是存储在这里好了,挂载点是挂载到this.controller里面去的

  //等待css切换时候哦需要替换的css
  cssSwitchFunc:[],

  init:function(){
    this.multiAsyncLoader.setAllLoadedFunc(function(){
      this.addComponent('controller',this.controllersCache[this.Router.controllerName],this.__proto__);
      if(this.controller.hasOwnProperty('action'+this.Router.actionName))
        this.controller['action'+this.Router.actionName].call(this.__proto__);
      if(this.debug)
        console.log('load done~');
      this.Router.afterAction();
    }.bind(this));

    window.addEventListener('DOMContentLoaded',this.multiAsyncLoader.loadPointAdd()); 
  },
  run:function(){
    //加载css
    var viewPath = this.Router.moduleName+'/views/'+this.Router.controllerName,

        commonControlleCss = viewPath+'/controller.css',
        commonActionCss    = viewPath+'/'+this.Router.actionName+'.css',
        commonJs           = viewPath+'/controller.js';

    this.cssLoader(this.$actionCss,[commonActionCss]);
    this.cssLoader(this.$controllerCss,[commonControlleCss]);

    //加载js
    if(!this.controllersCache.hasOwnProperty(this.Router.controllerName)){
      this.jsLoader(commonJs,this.multiAsyncLoader.loadPointAdd(function(rep){
        var code = new Function('exports',rep);

        this.controllersCache[this.Router.controllerName] = {},
        exports = this.controllersCache[this.Router.controllerName];
        
        code(exports);
        //然后读取deps,并且查询是否已经加载完成
        if(exports.deps){
          if(exports.deps.css)//css可以完全不做查询因为是怎量加载的
            this.cssLoader(this.$customCss,exports.deps.css);
          if(exports.deps.js)
            exports.deps.js.forEach(function(js){
              if(this.customJsCache.hasOwnProperty(js.url)){
                //直接挂在到this.controller.__proto__里面去,其实问题都不大,只是如果挂接在F.里面可以复用一下,但是基本上一次是储存,基本上都吧这些deps当作独立的使用,名字也是自己确定的
                //还是挂接在controller里面,反正浏览器有缓存
                //不行啊这个挂接不应该放在这时候弄的,等等这时候controller已经是挂接了,所以啊我就挂接在缓存的controller咯
                exports[js.name] = this.customJsCache[js.url];
              }else{
                this.jsLoader(js.url,
                  this.multiAsyncLoader.loadPointAdd(function(rep){
                      //感觉是需要做一些作用域的引用缓存的
                      var code = new Function('exports',rep),
                          exportsCustom = {};
                      
                      code(exportsCustom);

                      this.customJsCache[js.url] = exportsCustom;
                      exports[js.name] = exportsCustom;

                    },this)
                );
              };
            }.bind(this));
        }
      },this));
    }
  },
  cssSwitch:function(){
    this.cssSwitchFunc.forEach(function(func){
      func();
    });
  },
  cssLoader:function(container,cssUriArr){
    var unique = [];

    container.querySelectorAll('style').forEach(function(style){
      style.setAttribute('check','');
    });

    cssUriArr.forEach(function(cssUri){
      var check = container.querySelector('style[name="'+cssUri+'"]');
      if(check){
        //如果已经有的话 mark
        check.removeAttribute('check');
      }else{
        unique.push(cssUri);
      }
    });

    var emptyStyles = container.querySelectorAll('style[check]');

    emptyStyles.forEach(function(style,i){
      var args = {
        method:'get',
        url:unique[i],
        func:this.multiAsyncLoader.loadPointAdd(function(rep){
            this.cssSwitchFunc.push(function(){
              style.innerHTML = rep;
              style.setAttribute('name',unique[i]);
            }.bind(this));
            if(this.debug)
              console.log('one css loaded');
          }.bind(this)),
          error:function(errorCode){
            if(this.debug)            
              console.log(errorCode+' when loading :'+args.url);
            args.func('');
          }.bind(this)
      };

      var xhr = Ajax(args);
    }.bind(this));

    if(emptyStyles.length > unique.length){
      container.querySelectorAll('style[check]').forEach(function(style){
        container.removeChild(style);
      });
    }else{
      for(var i= emptyStyles.length ; i < unique.length; i++){
        var style = document.createElement('style');
            style.setAttribute('type','text/css');
            style.setAttribute('name',unique[i]);

        var args = {
          method:'get',
          url:unique[i],
          func:this.multiAsyncLoader.loadPointAdd(function(rep){
              this.cssSwitchFunc.push(function(){
                style.innerHTML = rep;
                style.setAttribute('name',unique[i]);
              }.bind(this));
              if(this.debug)              
                console.log('one css loaded');
            }.bind(this)),
            error:function(errorCode){
              if(this.debug)              
                console.log(errorCode+' when loading :'+args.url);
              args.func('');
            }.bind(this)
        };

        var xhr = Ajax(args);
        container.appendChild(style);
      }
    }
  },
  jsLoader:function(url,func){
    var xhr = Ajax({
      method:'get',
      url:url,
      func:func 
    });//在想这一层有什么用.....就是封装了一个get而已.....其他都是转发,算了
  }
});

//class Router
F.addComponent('Router',{
  moduleName:null,//string
  moduleName:null,//string
  actionName:null,//string
  actionConfig:{},
  preHash:null,

  afterAction:function(){
    if(this.preHash){
      location.hash = this.preHash;
      this.hashProcesser();
      this.preHash = null;
    }
    if(this.actionConfig.multiClick === 'true' && location.hash.search(/\[reseted\]/) == -1){
      location.hash += '[reseted]';
    }
  },
  hashProcesser:function(){
    if(location.hash.search(/\[reseted\]/) == -1){//反正这真的是不适合这个拓展的方式|| this.preHash
      //解析url
      this.analysisUrl();
      this.Loader.run();
    }
  },
  init:function(){
    //因为知道Router获取资源只会是使用一个multiAsyncLoader就可以咯
    //即便是在前一次hashchange没加载完之前,触发另一个hashchange,前一次加载的内容都会进行缓存,因为请求已经发送了
    //但是最后触发的action只是当前的action,相当于action切换等于终止取消前一个action的执行~~~~~
    //如果这时候是在actionReset的时候初始化的,默认重置去首页
    this.analysisUrl();
    if(this.actionName != 'Index'){
      this.preHash = location.hash;
      location.hash = this.controllerName+'/Index';
    }

    window.addEventListener('hashchange',this.hashProcesser.bind(this));

    this.hashProcesser();
  },
  analysisUrl:function(){
    var temp = location.href
              .replace('#','/')
              .replace(location.protocol+'//'+location.host+'/','')
              .match(/([^?]+)(\?.*)?/i),//默认还是去掉uri参数去处理~~不知道以后需不需要模拟正常的workflow
        uri = [];
    uri = temp[1].split('/');
    // uri[0] => modules
    // uri[1] => controllerName
    // uri[2] => actionName
    
    //格式规范
    uri[0] = uri[0];
    if(uri[1])
      uri[1] = firstLetterUp(uri[1]);
    if(uri[2])
      uri[2] = firstLetterUp(uri[2]);

    //缺省补全
    uri[1] = uri[1] || 'Home';
    uri[2] = uri[2] || 'Index';

    this.moduleName     = uri[0];
    this.controllerName = uri[1];
    this.actionName     = uri[2];

    //处理queryString,这里不是发送给服务器 而是action的setting
    if(temp[2]){
      this.actionConfig = {};
      temp[2].slice(1).split('&').forEach(function(i){
        var config = i.split('=');
        this.actionConfig[config[0]] = config[1];
      }.bind(this));
    }
  },
  url:function(){
    return [this.moduleName,this.controllerName,this.actionName].join('/');
  },
});

function MultiAsyncLoader(){
  var loadedCount = 0;
  var needToLoadCount = 0;
  var debug = false;
  var allLoadedFunc = function(){console.log('hi')};

  this.loadPointAdd = function(thisLoadedFunc,that){
    needToLoadCount++;
    thisLoadedFunc || (thisLoadedFunc = function(){});
    that || (that = null);
    
    if(debug)
      console.log('增加了一个加载项~');
    return function(){
      if(debug)
        console.log('加载了一个,还需加载:'+(needToLoadCount-loadedCount));
      thisLoadedFunc.apply(that,arguments);
      //我想传进来的func里面的this访问现在这一层this,不通过传参,但是之前已经bind一个this的obj
      //所以想把func里面所bind的this提取出来加工一下
      loadedCount++;
      if(loadedCount === needToLoadCount){
        allLoadedFunc();
        if(debug)
          console.log('所有东东都加载完成了,最后的func也触发了~~');
      }
    };
  };

  this.setAllLoadedFunc = function(func){
    allLoadedFunc = func;
  };
  this.init = function(){
    loadedCount = needToLoadCount = 0;
  }
}

function Ajax(args){//method,url,arg,content,func,要么就是干脆不是get就是post算了,但是之后怎样做restful,,真纠结,还是通用一些吧~~
  var method = args['method'],
      url = args['url'],
      arg = args['arg'] || null,
      data = args['data'] || '',
      func = args['func'] || function(){},
      error = args['error'] || function(){};
  
  function arrToUrlArg(obj){
    var arg = '?';
    for(var p in obj)
        arg += p+'='+obj[p]+'&';
    return arg.slice(0,-1);
  }

  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function(){
      if( xhr.readyState == 4){
        if(xhr.status >= 200 && xhr.status < 300)
          func(xhr.responseText);
        else
          error(xhr.status);
      }
  };
  xhr.onabort = xhr.onerror = error;
  if(!arg)
    xhr.open(method,url,true);
  else
    xhr.open(method,url+arrToUrlArg(arg),true);
  xhr.send(data);
  return xhr;
}

//控件
var widget = {
  add:function(name,constructor){
    constructor.prototype = this;
    this[name] = constructor;
  }
};

//这部分是utility,

//其实这些 应该是很少的,如果是十分多的都应该是打包成一个类的其实要么就是直接挂接在
function firstLetterUp(str){
  // str = str.toLowerCase();
  str = str[0].toUpperCase()+str.substr(1);
  return str;
}

function css(elem,style){
    for(var p in style){
        elem.style[p] = style[p];
    }
}

function checkIn(arg,arr){
    for(var i = 0; i < arr.length; i++){
        if(arr[i] == arg )
            return true;
    }
    return false;
}

function strToDom(str){
    var div = document.createElement('div');
    div.innerHTML = str;
    return div.firstElementChild;
}

function dump(dom){
    for(var p in dom){
        console.log(p+':'+dom[p]);
    }
}

function maskOn(func){
    css(document.querySelector('#mask'),{
        'display': 'block',
        'z-index': '100',
        
    });
    setTimeout(function() {
        css(document.querySelector('#mask'),{
            'opacity': '0.3'
        });
    }, 10);
    //禁止页面滚动
    // document.body.style.overflow='hidden';
    css(document.querySelector('#mask-blur'),{
        '-webkit-filter': 'blur(1.5px)',
        'filter': 'blur(1.5px)',
    });
    document.querySelector('#mask').onclick = function(){
        if(func) func();
        maskOff();
    };
    //至于mask使用的唯一性,只能通过自己注意一下
}
function maskOff(){
    css(document.querySelector('#mask'),{
        'opacity': '0'
    });
    setTimeout(function() {
        css(document.querySelector('#mask'),{
            'display': 'none',
            'z-index': '-10',
        });
    }, 300);
    // document.body.style.overflow='';
    css(document.querySelector('#mask-blur'),{
        '-webkit-filter': 'blur(0px)',
        'filter': 'blur(0px)',
    });
}

function $(elem){
    return document.getElementById(elem);
}

function $$(elem){
    return document.getElementsByClassName(elem);
}