/* ***** BEGIN LICENSE BLOCK *****
 *
 * @COPYRIGHT@
 *
 * This file is part of the Adaptable XML Editing Library (AXEL), version @VERSION@ 
 *
 * @LICENSE@
 *
 * Web site : http://media.epfl.ch/Templates/
 * 
 * Author(s) : Stéphane Sire, Stéphane Martin
 * 
 * ***** END LICENSE BLOCK ***** */

(function ($axel) {

  var _Generator = function ( aContainer, aXTUse, aDocument ) {
    var htag = aXTUse.getAttribute('handle') || 'span';
    var h = xtdom.createElement(aDocument, htag);
    var t = xtdom.createTextNode(aDocument, '');
    h.appendChild(t);
    xtdom.addClassName(h, 'axel-core-on');
    aContainer.appendChild(h);
    return h;
  };

  // Uses a closure to store class level private utility properties and functions
  var _Editor = (function () {
  
    xtdom.extractDefaultContentXT = extractDefaultContentXT;

    var _timestamp = -1;
	
	/* The format names as displayed on the buttons and their corresponding CSS span.class*/
	var formatsAndCSS = [ 
		{name : 'Bold', style : 'bold'},
		{name : 'Italics', style : 'italics'},
	    {name : 'Underline', style : 'underline'},
		{name : 'Strike', style : 'line-through'}
	];
	
	function recognizedStyles() {
	    var ret = []
		for (fn in formatsAndCSS) {
		    ret.push(fn.style);
		}
		return ret;
	}
	
	var styles = recognizedStyles();
	
	var classToKind = { // Do we really need that translation ???
	    'bold' : 'b',
		'italics' : 'i',
		'underline' : 'u',
		'line-through': 'lt'
	};

    function _focusAndSelect ( editor ) {
      // pre-condition: the editor's handle must already have focus
      try {
        editor.getDocument().execCommand('selectAll', false, ''); // FIXME: fails on iPad
      }
      catch (e) { }
    }

    function _trim ( str ) {
      var tmp = str.replace(/\s+/gi,' ');
      if (/\s/.test(tmp.charAt(0))) {
        tmp = tmp.substr(1);
      }
      if (/\s$/.test(tmp)) {
        tmp = tmp.substr(0, tmp.length-1);
      }
      return tmp;
    }

    // Checks node contains only a text node, otherwise recreate it
    // (this can be used to prevent cut and paste side effects)
    function _sanitize ( node, doc ) {
      var tmp = '';
      if ((node.children.length > 1) || (node.firstChild && (node.firstChild.nodeType !== xtdom.TEXT_NODE))) {
        // Detect whether the browser supports textContent or innerText
        if (typeof node.textContent === 'string') {
          tmp = node.textContent;
        } else if (typeof node.innerText === 'string') {
          tmp = node.innerText;
        }
        node.innerHTML = '';
        t = xtdom.createTextNode(doc, tmp ? _trim(tmp) : tmp);
        node.appendChild(t);
      }
	  
    }
	
	/*
	  Extracts the content of an XTiger node. We need a function different from the default
	  xtdom.extractDefaultContentXT() because the latter only extracts text content (by 
	  concatenating the inner HTML of possible subnodes). Any formatting information is lost in 
	  the process. Our method keeps the CSS formatting of span subnodes mentionned in formatsAndCSS.
	*/
	function extractDefaultContentXT(node) {
	  if (xtiger.ATTRIBUTE == xtdom.getNodeTypeXT(node)) {
		var dump = node.getAttribute('default');
		if (dump && (-1 === dump.search(/\S/)))  {
		    return null;
		}
	  }
	  
	  function innerText(node) {
	      if (node.nodeType == xtdom.TEXT_NODE) {
		     return node.textContent;
		  } else if (node.childNodes) {
		      var ret = "";
		      for (var i = 0; i < node.childNodes.length; i++) {
			    ret += innerText(node.childNodes[i]);
			  }
			  return ret;
		  } else {
		      return ""
		  }
	  }
	  
	  //alert('here ' + node.outerHTML)
	  
	  if (node.childNodes) {
	    var root = document.createElement('span');
		var cur;
		while (node.firstChild) {
		    cur = node.firstChild;
			if (cur.nodeType === xtdom.ELEMENT_NODE && (cur.tagName === 'span' || cur.tagName === 'a')) {
			    root.appendChild(cur);
			} else {
			    var span = document.createElement('span');
				span.innerHTML = innerText(node.firstChild);
				node.removeChild(node.firstChild);
				root.appendChild(span);
			}
		}
	  }
	  
	  //alert('root ' + root.outerHTML);
	  return root;
	}

	
	function normalize(content, doc) {
	    // TODO should normalize ill-formed data as much as possible
		if (typeof content === typeof 'abc') {
		    var span = xtdom.createElement(doc, 'span');
			span.innerHTML = content;
			return span;
		}
		
		return content;
	}
	
	function classToFragStyle(className) {
	    return className.replace(/\s+/g, '_');
	}
	
	function logSpansToFragments(root, logger) {
		for (var i = 0; i < root.childNodes.length; i++) {
		    logger.openTag('Fragment');
			if (root.childNodes[i].className) {
			    logger.openAttribute('RichStyle');
			    logger.write(classToFragStyle(root.childNodes[i].className));
				logger.closeAttribute('RichStyle');
			}
			if (root.childNodes[i].tagName === 'a' && root.childNodes[i].href) {
			    logger.openAttribute('Href');
			    logger.write(root.childNodes[i].href);
				logger.closeAttribute('Href');			    
			}
			logger.write(root.childNodes[i].textContent);
			logger.closeTag('Fragment');
		}
	}
	
	function fragStyleToClass(richStyle) {
	    return richStyle.replace(/_/g, ' ');
	}
	
	function fragsToSpans(frags, doc) { // we should try to take into account ill-formed fragments...
	    try {
	    var root = xtdom.createElement(doc, 'span');
	    //alert(frags.childNodes)
		//var lowFrag = 'Fragment'.toLower().valueOf();
		for (var i = 0; i < frags.childNodes.length; i++) {
		    if (frags.childNodes[i].nodeType === Node.ELEMENT_NODE && frags.childNodes[i].tagName.toLowerCase() == 'fragment')  {
			    var span = xtdom.createElement(doc, 'span');
				if (frags.childNodes[i].getAttribute('RichStyle')) {
				    var style = frags.childNodes[i].getAttribute('RichStyle');
				    xtdom.addClassName(span, fragStyleToClass(style));
				}
				var text = xtdom.createTextNode(doc, frags.childNodes[i].textContent);
				span.appendChild(text);
		        //alert(frags.childNodes[i].tagName)
				root.appendChild(span);
		    } 
		}
		} catch (e) {alert(e)}
		//alert(root.outerHTML);
		return root;
	}
	
	function interceptPaste(event) {
		if (window.clipboardData) {
			alert('1: ' + JSON.stringify(window.clipboardData.getData("Text")));
		} else {
			alert('2: ' + JSON.stringify(event.clipboardData.getData('text/html')));
		}
		return false;
	}
	
	function inheritClass(node, tag) {
		if (hasClass(node, tag)) {
			return true;
		} else if (! node.parentNode) {
			return false
		} else { 
			return inheritClass(node.parentNode, tag);
		}
	}
	
	function hasClass(node, tag) {
		if (node.getAttribute) {
			return (' ' + node.getAttribute('class') + ' ' ).indexOf(' ' + tag + ' ') != -1;
		} else {
			return false;
		}
	}
	
	function allChildrenTagged(node, tag) {
		for (var i = 0; i < node.childNodes.length; i++) {
			if (! hasClass(node.childNodes[i], tag) && node.childNodes[i].innerHTML !== "") {
				return false;
			}
		}
		return true;
	}
	
	function addClass(node, tag) {
		if (! hasClass(node, tag)) {
			node.className = (node.className + ' ' + tag).trim();
		}
		//alert(node.outerHTML)
	}
	
	function removeClass(node, tag) {
		//alert(node.outerHTML)	
        var className = (' ' + node.className + ' ').replace(' ' + tag + ' ', ' ').trim();		
		node.className = className;
		//alert(node.outerHTML)
	}
	
	function equalClasses(primus, secundus) {
		var pri = primus.className.match(/\S+/g);
		var sec = secundus.className.match(/\S+/g);
		
		//alert(JSON.stringify(pri) + ' ' + JSON.stringify(sec)) 
		
		if (! pri) {
			pri = [];
		}
		
		if (! sec) {
			sec = [];
		}
		
		if (pri.length != sec.length) {
			return false;
		}
		
		pri.sort();
		sec.sort();
		
		for (var i = 0; i < pri.length; i++) {
		   if (pri[i] !== sec[i]) {
		       return false;
		   }
		}
		return true;
	}
	
	function equalTags(primus, secundus) {
	    return primus.tagName === secundus.tagName;
	}
	
	function inLink(node) {
	    if (node.href) {
		    return node.href;
		} else if (node.parentNode){
			return inLink(node.parentNode);
		} else {
		    return null;
		}
	}
	
	function toggleButtons(instance) {
	    try{
	    if (instance.editInProgress) {
		    instance.stopEditing();
			xtdom.setAttribute(instance._handle, 'contenteditable', 'false');
	    } else if (instance.getParam('noedit') !== 'true') {
          xtdom.setAttribute(instance._handle, 'contenteditable', 'true');
          //xtdom.addClassName(instance._handle, 'axel-core-editable');
          _timestamp = new Date().getTime();
		  instance._handle.addEventListener('paste', function (ev) {interceptPaste(ev); return false;})
		  instance.startEditing();
        }
		} catch (e) {alert('toggle ' + e)}
	}

    return {

      ////////////////////////
      // Life cycle methods //
      ////////////////////////

      onInit : function ( aDefaultData, anOptionAttr, aRepeater ) {
	    try {
	    var data = normalize(aDefaultData, this.getDocument());
        if (! data) { 
          this._content = '<span>Click to edit</span>'; // should make a function to ensure proper structure of the content
        }
        this._setData(data);
		/*while (this._handle.firstChild) {
		    this._handle.removeChild(this._handle.firstChild);
		}
		while (data.firstChild) {
		    this._handle.appendChild(data.firstChild);
		}
        this.model = data*/
        //alert(this._handle.outerHTML)		
        if (this.getParam('hasClass')) {
          xtdom.addClassName(this._handle, this.getParam('hasClass'));
        }
        this.keyboard = xtiger.session(this.getDocument()).load('keyboard');
        this.editInProgress = false;
		this.createButtons();
		} catch (e) {alert(e)}
      },

      // Awakes the editor to DOM's events, registering the callbacks for them
      onAwake : function () {
        /*var _this = this;
        if (this.getParam('noedit') !== 'true') {
          xtdom.setAttribute(this._handle, 'contenteditable', 'true');
          xtdom.addClassName(this._handle, 'axel-core-editable');
          // 'mousedown' always preceeds 'focus', saves shiftKey timestamp to detect it in forthcoming 'focus' event
          xtdom.addEventListener(this._handle, 'mousedown', function(ev) { if (ev.shiftKey) { _timestamp = new Date().getTime(); } }, true);
          // tracks 'focus' event in case focus is gained with tab navigation  (no shiftKey)
          xtdom.addEventListener(this._handle, 'focus', function(ev) {  _this.startEditing(); }, true);
          if (xtiger.cross.UA.gecko) {  // gecko: prevent browser from selecting contentEditable parent in triple clicks ! 
            xtdom.addEventListener(this._handle, 'mousedown', function(ev) { if (ev.detail >= 3) { xtdom.preventDefault(ev);xtdom.stopPropagation(ev);_this._handle.focus();_focusAndSelect(_this); } }, true);
          }
          if (xtiger.cross.UA.webKit) {
            this.doSelectAllCb = function () { _focusAndSelect(_this); }; // cache function
          }
          // TODO: instant paste cleanup by tracking 'DOMNodeInserted' and merging each node inserted ?
        }
        this.blurHandler = function (ev) { _this.handleBlur(ev); };*/
      },

      onLoad : function (aPoint, aDataSrc) {
        var _value, _default;
        if (aPoint !== -1) { 
          _value = fragsToSpans(aPoint[0], this.getDocument());//aDataSrc.getDataFor(aPoint);
          _default = this.getDefaultData();
          defval = _value || _default;
		  //alert(this._handle.outerHTML)
          this._setData(defval);
		  //alert(this._handle.outerHTML)
          this.setModified(_value !==  _default);
          this.set(false);
        } else {
          this.clear(false);
        }
		//alert(this._handle.outerHTML)
      },

      onSave : function (aLogger) {
        if (this.isOptional() && (!this.isSet())) {
          aLogger.discardNodeIfEmpty();
          return;
        }
        if (this._handle) {
		  try {
	      logSpansToFragments(this._handle, aLogger);
		  } catch (e) {alert(e)}
        }
      },

      ////////////////////////////////
      // Overwritten plugin methods //
      ////////////////////////////////

      api : {
      
        isFocusable : function () {
          return this.getParam('noedit') !== 'true';
        },

        focus : function () {
          this._handle.focus(); // should trigger focus event
        },

        unfocus : function () {
          this.stopEditing(false);
        },
		
		getDefaultData : function () {
          return this._content;
        }
      },

      /////////////////////////////
      // Specific plugin methods //
      /////////////////////////////

      methods : {

        // Sets editor model value. Takes the handle and updates its DOM content.
        _setData : function (aData) {
		  try {		
		  //alert(aData.outerHTML)

		  while (this._handle.firstChild) {
		      this._handle.removeChild(this._handle.firstChild);
		  }
		  while (aData.firstChild) {
		      this._handle.appendChild(aData.firstChild);
		  }
		  
          this.model = aData;
		  } catch (e) {alert(e)}
		  
        },

        // AXEL keyboard API (called from Keyboard manager instance)
        isEditing : function () {
          return this.editInProgress !== false;
        },

         // AXEL keyboard API (called from Keyboard manager instance)
        cancelEditing : function () {
          this.stopEditing(true);
        },

         // AXEL keyboard API (called from Keyboard manager instance)
        doKeyDown : function (ev) { 
        },

         // AXEL keyboard API (called from Keyboard manager instance)
        doKeyUp : function (ev) { 
        },
		
		makeLink : function (urlNode, link) {
		    var url = urlNode.value;
			if (url.indexOf('http://') != 0 && url.indexOf('https://') != 0) {
			    url = 'http://' + url;
			}
			
			// we should check urls are valid
			
			if (link) {
			    var mainTag = 'a';
			} else {
			    var mainTag = 'span';
			}
            var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);
			var newNode = xtdom.createElement(this.getDocument(), mainTag);
			if (mainTag === 'a') {
			    newNode.setAttribute('href', url);	
			}
			var content = range.extractContents()
			newNode.appendChild(content)
			newNode.setAttribute('data-mark', 'new-l'); // test only
			range.insertNode(newNode)
			
			var root = this._handle;
			
			//alert(root.outerHTML)
			
			var tempRoot = xtdom.createElement(this.getDocument(), 'span');
            //tempRoot.setAttribute('href', url);
			try {			

			while (root.firstChild) {
			    if (root.firstChild.firstChild) {
				    while (root.firstChild.firstChild) {
					    if (root.firstChild.firstChild.nodeType === xtdom.TEXT_NODE) {		
                            var tag = root.firstChild.tagName;						
						    var newFrag = xtdom.createElement(this.getDocument(), tag); // xtdom...
							if (tag === 'a') {
							    newFrag.setAttribute('href', url);	
							}
							addClass(newFrag, root.firstChild.className);
							addClass(newFrag, root.firstChild.firstChild.className);
							newFrag.appendChild(root.firstChild.firstChild);
							tempRoot.appendChild(newFrag);
						} else {
						    if (root.firstChild.firstChild.tagName !== mainTag) {
							    var cur = xtdom.createElement(this.getDocument(), mainTag);
								cur.innerHTML = root.firstChild.firstChild.innerHTML;
								if (root.firstChild.href) {
								    cur.setAttribute('href', root.firstChild.href);
								}
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className);
								root.firstChild.removeChild(root.firstChild.firstChild);
							} else {
							    var cur = root.firstChild.firstChild;
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className);
							}
						    tempRoot.appendChild(cur);
						}
					}
				} else {
				    tempRoot.appendChild(root.firstChild);
				} 
			}
			
			} catch (e) {alert(e)}
			//alert(tempRoot.outerHTML)
			
			var prev = tempRoot.firstChild;
			root.appendChild(prev);
			
			while (tempRoot.firstChild) {
				if (prev.className === "") {
				    prev.removeAttribute("class");
				}
			    if (equalClasses(prev, tempRoot.firstChild) && equalTags(prev, tempRoot.firstChild)) {
				    //alert(prev.outerHTML + "--" + tempRoot.firstChild.outerHTML)
				    prev.innerHTML = prev.innerHTML + tempRoot.firstChild.innerHTML;
					tempRoot.removeChild(tempRoot.firstChild);
				} else if (tempRoot.firstChild.innerHTML === "") {
				    tempRoot.removeChild(tempRoot.firstChild);
				} else {
				    prev = tempRoot.firstChild;
				    root.appendChild(prev);
				}
			}
				
            //alert(this._handle.outerHTML)

		},
		
		enrich : function (style) {
		
		    //alert(style)
			
		 try { // temporary during tests
            var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);
			//alert(range)
			var newNode = xtdom.createElement(this.getDocument(), 'span');
			var content = range.extractContents()
			newNode.appendChild(content)
			
			newNode.setAttribute('data-mark', 'new') 
			
			range.insertNode(newNode)
			
			//alert(this._handle.outerHTML)
			//alert(newNode.outerHTML);

			var root = this._handle;

			if (inheritClass(newNode, style)) {
			    var inherit = true;
			} else {
			    var inherit = false;
			} 
			
			if (allChildrenTagged(newNode, style)) {
			    var allTagged = true;
			} else {
			    var allTagged = false;
			}					
			
			var tempRoot = xtdom.createElement(this.getDocument(), 'span');	

			//alert(this._handle.outerHTML)
			
			while (root.firstChild) {
			    if (root.firstChild.firstChild) {
				    while (root.firstChild.firstChild) {
					    if (root.firstChild.firstChild.nodeType === xtdom.TEXT_NODE) {
						    var href = inLink(root.firstChild);
						    var tag = href ? 'a' : 'span'; // necesssary ?				
						    var newFrag = xtdom.createElement(this.getDocument(), tag); // xtdom...
							if (href) {
							    newFrag.setAttribute('href', href);
							}
							addClass(newFrag, root.firstChild.className);
							newFrag.appendChild(root.firstChild.firstChild);
							tempRoot.appendChild(newFrag);
						} else {
							var href = inLink(root.firstChild.firstChild);
							if (href) {
							    var cur = xtdom.createElement(this.getDocument(), 'a'); // xtdom...
								cur.innerHTML = root.firstChild.firstChild.innerHTML;
								cur.setAttribute('href', href);
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className);
								root.firstChild.removeChild(root.firstChild.firstChild);
							} else {
							    var cur = root.firstChild.firstChild;
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className); // try without
								//alert(cur.outerHTML)
							}
							if (!allTagged && !inherit) {
							    //alert('added 2')
							    addClass(cur, style);
							} else {
							    //alert('removed')
							    removeClass(cur, style);
							}
							tempRoot.appendChild(cur);
						}
					}
				} else {
				    tempRoot.appendChild(root.firstChild);
				} 
			}
			
			var prev = tempRoot.firstChild;
			root.appendChild(prev);
			
			while (tempRoot.firstChild) {
				if (prev.className === "") {
				    prev.removeAttribute("class");
				}
			    if (equalClasses(prev, tempRoot.firstChild) && equalTags(prev, tempRoot.firstChild)) {
				    //alert(prev.outerHTML + "  " + tempRoot.firstChild.outerHTML)
				    prev.innerHTML = prev.innerHTML + tempRoot.firstChild.innerHTML;
					tempRoot.removeChild(tempRoot.firstChild);
				} else if (tempRoot.firstChild.innerHTML === "") {
				    tempRoot.removeChild(tempRoot.firstChild);
				} else {
				    prev = tempRoot.firstChild;
				    root.appendChild(prev);
				}
			}
			
			
		} catch (e) {alert('here '+  e)}
			
			//alert(this._handle.outerHTML)
		},
		
		createButtons : function () {
		
		  var buttons = xtdom.createElement(this.getDocument(), 'div');

		  buttons.setAttribute('style', 'display:none; padding-top:20px;');
		  //buttons.setAttribute('class', 'axel-core-o');
		  this._handle.parentNode.insertBefore(buttons, this._handle.nextSibling);
          //alert(this._handle.outerHTML)		  
		  this.buttonBox = buttons;
		  
		  var _this = this;
		  
		  for (var i = 0; i < formatsAndCSS.length; i++) {
		      var button = xtdom.createElement(this.getDocument(), 'button');
			  button.setAttribute('class', 'button-as-links');
			  var inner = xtdom.createElement(this.getDocument(), 'span');
			  var style = formatsAndCSS[i].style;
			  inner.setAttribute('class', style);
			  inner.textContent = formatsAndCSS[i].name;
		      button.appendChild(inner);
		      buttons.appendChild(button);	
			  
			  function callToEnrich(style) {
			      return function() {
					  _this.enrich(style);
				  };
			  };
			  
              xtdom.addEventListener(button, 'click', callToEnrich(style), false);  
		  }
		  

		  var linkArea = xtdom.createElement(this.getDocument(), 'textarea');
		  linkArea.setAttribute('class', 'url-box');
		  var makeLinkButton = xtdom.createElement(this.getDocument(), 'span');
		  //makeLinkButton.setAttribute('class', 'button-as-links');
		  var innerLinkButton = xtdom.createElement(this.getDocument(), 'button');
		  innerLinkButton.setAttribute('class', 'button-as-links');
		  innerLinkButton.textContent = 'Link';
		  var innerUnlinkButton = xtdom.createElement(this.getDocument(), 'button');
		  innerUnlinkButton.setAttribute('class', 'button-as-links');
		  innerUnlinkButton.textContent = 'Unlink';
		  makeLinkButton.appendChild(innerLinkButton);
		  makeLinkButton.appendChild(xtdom.createTextNode(this.getDocument(), ' / '));
		  makeLinkButton.appendChild(innerUnlinkButton);
		  xtdom.addEventListener(innerLinkButton, 'click', function () {_this.makeLink(linkArea, true); return false}, false);
		  xtdom.addEventListener(innerUnlinkButton, 'click', function () {_this.makeLink(linkArea, false); return false}, false);
		  linkArea.value = 'http://...';
		  linkBox = xtdom.createElement(this.getDocument(), 'div');
		  //linkArea.style.display = 'none';	
          //makeLinkButton.style.display = 'none';	
		  linkBox.appendChild(linkArea);
		  linkBox.appendChild(makeLinkButton);
		  buttons.appendChild(linkBox);

		  var toggleButton = xtdom.createElement(this.getDocument(), 'div');
		  toggleButton.setAttribute('style', 'float:right;');
		  toggleButton.setAttribute('class', 'edit-button');
		  toggleButton.textContent = 'Edit';
		  this.toggleButton = toggleButton;
		  
		  xtdom.addEventListener(toggleButton, 'click', function () {toggleButtons(_this);}, false); 
		  
		  this._handle.parentNode.insertBefore(toggleButton, this._handle.nextSibling);
	 
		},
		

        // Starts editing the field (to be called once detected)
        startEditing : function () {
		  if (this.editInProgress) {
		      return;
		  }

		  var _this = this;
		  
		  //alert(this._handle.parentNode.outerHTML)
		  
		  //_test()
		  
		  //this._handle.addEventListener('keydown', function() {_keyDownEvent()})
		  		  
		  this.editInProgress = true;		  
		  this.buttonBox.style.display = 'block';
		  this.toggleButton.textContent = 'Close';
		  
          // avoid reentrant calls (e.g. user's click in the field while editing)
          //if (this.editInProgress === false) {
          //  this.editInProgress = true;
            // registers to keyboard events
            this.kbdHandlers = this.keyboard.register(this);
            this.keyboard.grab(this, this);
    //        xtdom.removeClassName(this._handle, 'axel-core-editable');
            if ((!this.isModified()) || ((_timestamp !== -1) && ((_timestamp - new Date().getTime()) < 100))) {
              /*if (xtiger.cross.UA.webKit) {
                // it seems on webkit the contenteditable will really be focused after callbacks return
                setTimeout(this.doSelectAllCb, 100);
              } else {
                _focusAndSelect(this); 
              }*/
            //}
            // must be called at the end as on FF 'blur' is triggered when grabbing
            xtdom.addEventListener(this._handle, 'blur', this.blurHandler, false);
          }
        },

        // Stops the edition process on the device
        stopEditing : function (isCancel) {
          if ((! this.stopInProgress) && (this.editInProgress !== false)) {
            this.stopInProgress = true;
			this.buttonBox.style.display = 'none';
			this.toggleButton.textContent = 'Edit';
			//this.toggleButton.setAttribute('style', 'color:blue; float:right;');
            _timestamp = -1;
            this.keyboard.unregister(this, this.kbdHandlers);
            this.keyboard.release(this, this);
            //this._handle.blur();
    //        xtdom.addClassName(this._handle, 'axel-core-editable');
            this.stopInProgress = false;
            this.editInProgress = false;
          }
        },

        // Updates the editor data model with the given data
        // This gives a chance to normalize the input
        update : function (aData) { 
          /*if (handle === this.model) { // no change
            return;
          }
          // normalizes text (empty text is set to _defaultData)
          if ((!handle) || (handle.innerHTML.search(/\S/) === -1) || (handle === this.getDefaultData())) {
            this.clear(true);
            return;
          }
          this._setData(handle);
          this.setModified(true);
          this.set(true);*/
        },

        // Clears the model and sets its data to the default data.
        // Unsets it if it is optional and propagates the new state if asked to.     
        clear : function (doPropagate) {
          this._setData(this.getDefaultData());
          this.setModified(false);
          if (this.isOptional() && this.isSet()) {
            this.unset(doPropagate);
          }
        },

        handleBlur : function (ev) {
		    //alert(document.activeElement.contentDocument.activeElement)
		    //_this.stopEditing(false);
		  //this.buttonBox.focus();
		  //alert('ok')
		 /* var _this = this;
		  setTimeout(function () {
		      //alert('handle ' + _this.buttonBox.clicked);
			  if (_this.buttonBox.clicked) {
			      //alert('clicked');
				  _this.enrich(_this.buttonBox.clicked);
				  //_this.buttonBox.clicked = undefined;
			  } else {
			      //alert('stop');
			      
			  }}, 100);*/
		  //this.buttonBox.addEventListener
		  //setTimeout(function () {alert('handle ' + document.activeElement)}, 500)
        }
      }
    };
  }());

  $axel.plugin.register(
    'richContent', 
    { filterable: false, optional: true },
    { 
      noedit : 'false'
    },
    _Generator,
    _Editor
  );
}($axel));
