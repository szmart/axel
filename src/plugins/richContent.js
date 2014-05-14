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

  var handleTag = 'span'; //default is span

  var _Generator = function ( aContainer, aXTUse, aDocument ) {
    var params = aXTUse.getAttribute('param');
	var paramDict = {};
	xtiger.util.decodeParameters(params, paramDict);
	var defaultTag = paramDict['multilines'] === 'normal' ? 'pre' : 'span';
    handleTag = aXTUse.getAttribute('handle') || defaultTag;
    var handle = xtdom.createElement(aDocument, handleTag);
    var t = xtdom.createTextNode(aDocument, '');
    handle.appendChild(t);
    xtdom.addClassName(handle, 'axel-core-on');
	var span = xtdom.createElement(aDocument, 'span');
    aContainer.appendChild(handle);
    return handle;
  };

  // Uses a closure to store class level private utility properties and functions
  var _Editor = (function () {
	
	var urlPattern = new RegExp(/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,}\.[a-z]{2,}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi);

    var _timestamp = -1;
	
	/* The format names as displayed on the buttons and their corresponding CSS span.class*/
	var formatsAndCSS = [ 
		{name : 'Bold', style : 'bold'},
		{name : 'Italics', style : 'italics'},
	    {name : 'Underline', style : 'underline'},
		{name : 'Strike', style : 'line-through'}
	];
	
	var dataConfigS = {
	    spans : {
	        link : {tag : 'a', ref : 'href', style : 'class'},
		    standard : {tag : 'span', style : 'class'}
	    },
	    fragments : {
	        link : {tag : 'Link', ref : {tag : 'LinkRef'}, text : {tag : 'LinkText', style : 'RichStyle'}},
		    standard : {tag : 'Fragment', style : 'RichStyle'}
	    }
    }	
	

	function _formats() {
	    var ret = []
	    for (var i = 0; i < formatsAndCSS.length; i++) {
		    ret.push(formatsAndCSS[i].style);
		}
		return ret;
	}
	
	var allowedCSS = _formats();
	
	function allowedStyle(style) {
	    if (!style) {
		    return null;
		}

	    var splits = style.split(/ /);
		var ret = [];
		for (var i = 0; i < splits.length; i++) {
		    if (allowedCSS.indexOf(splits[i]) !== -1) {
			    ret.push(splits[i]);
			}
		}
		return ret.join(' ');
	}	
	
	var _getPopupDevice = function (aDocument) {
	   var devKey = 'popupdevice';
	   var device = xtiger.session(aDocument).load(devKey);
	   if (! device) {  // lazy creation
		 device = new xtiger.editor.PopupDevice (aDocument); // hard-coded device for this model
		 xtiger.session(aDocument).save(devKey, device);
	   }
	   return device;
    };

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
		
	function extractFragmentContentXT(node) {

	    var dataConfig = dataConfigS.fragments;
	    if (xtiger.ATTRIBUTE == xtdom.getNodeTypeXT(node)) {
		    var dump = node.getAttribute('default');
		    if (dump && (-1 === dump.search(/\S/)))  {
		        return null;
		    }
        }

	  if (node.childNodes) {
	    var root = document.createElement('span');
		var cur;
		while (node.firstChild) {
		    cur = node.firstChild;
			if (cur.nodeType === xtdom.ELEMENT_NODE && cur.tagName === dataConfig.standard.tag) {
			    var span = document.createElement('span');
				span.innerHTML = innerText(cur);
				var style = allowedStyle(cur.getAttribute(dataConfig.standard.style));
				if (style) {
				    span.setAttribute('class', style);
				}
				node.removeChild(cur);
				root.appendChild(span);			
			} else 	if (cur.nodeType === xtdom.ELEMENT_NODE && cur.tagName === dataConfig.link.tag) {
			    var a = document.createElement('a');
				while (cur.firstChild) {
					if (cur.firstChild.tagName === dataConfig.link.ref.tag) {
						a.setAttribute('href', cur.firstChild.innerHTML);
				    } else if (cur.firstChild.tagName === dataConfig.link.text.tag) {
						a.innerHTML = cur.firstChild.innerHTML;
				        var style = allowedStyle(cur.firstChild.getAttribute(dataConfig.link.text.style));
				        if (style) {
				            a.setAttribute('class', style);
				        }
				    }
				    cur.removeChild(cur.firstChild);
                }	
				root.appendChild(a);	
				node.removeChild(cur);				
			} else {
			    node.removeChild(cur);
			}
		}
	  } else {
	    var root = document.createElement('span');
		root.innerHTML = innerText(node);
	  }

	  return root;
	}
	
	/*
	  Extracts the content of an XTiger node. We need a function different from the default
	  xtdom.extractDefaultContentXT() because the latter only extracts text content (by 
	  concatenating the inner HTML of possible subnodes). Any formatting information is lost in 
	  the process. Our method keeps the CSS formatting of span subnodes mentionned in formatsAndCSS.
	*/
	function extractSpanContentXT(node) {
	    var dataConfig = dataConfigS.spans;
	    if (xtiger.ATTRIBUTE == xtdom.getNodeTypeXT(node)) {
		    var dump = node.getAttribute('default');
		    if (dump && (-1 === dump.search(/\S/)))  {
		        return null;
		    }
        }

	  if (node.childNodes) {
	    var root = document.createElement('span');
		var cur;
		while (node.firstChild) {
		    cur = node.firstChild;
			if (cur.nodeType === xtdom.ELEMENT_NODE && cur.tagName === dataConfig.standard.tag) {
			    var span = document.createElement('span');
				span.innerHTML = innerText(cur);
				var style = allowedStyle(cur.getAttribute(dataConfig.standard.style));
				if (style) {
				    span.setAttribute('class', style);
				}
				node.removeChild(cur);
				root.appendChild(span);			
			} else 	if (cur.nodeType === xtdom.ELEMENT_NODE && cur.tagName === dataConfig.link.tag) {
			    var a = document.createElement('a');
				a.setAttribute('href', cur.getAttribute(dataConfig.link.ref));
			    a.innerHTML = innerText(cur);
				var style = allowedStyle(cur.getAttribute(dataConfig.standard.style));
				if (style) {
				    a.setAttribute('class', style);
				}
				node.removeChild(cur);
				root.appendChild(a);			
			} else {
			    node.removeChild(cur);
			}
		}
	  } else {
	    var root = document.createElement('span');
		root.innerHTML = innerText(node);
	  }
	  
	  return root;
	}
	
	
	xtdom.extractDefaultContentXT = function (node) {
	    return node;
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
	
	function logToSpans(root, logger) {
	    var dataConfig = dataConfigS.spans;
		for (var i = 0; i < root.childNodes.length; i++) {
			if (root.childNodes[i].tagName === 'a' && root.childNodes[i].href) {
			    logger.openTag(dataConfig.link.tag);
			    if (root.childNodes[i].className) {
			        logger.openAttribute(dataConfig.link.style);
			        logger.write(classToFragStyle(root.childNodes[i].className));
				    logger.closeAttribute(dataConfig.link.style);
				}
				logger.openAttribute(dataConfig.link.ref);
				logger.write(root.childNodes[i].href);
				logger.closeAttribute(dataConfig.link.ref);
				logger.write(root.childNodes[i].textContent);
			    logger.closeTag(dataConfig.link.tag);			    
			} else if (root.childNodes[i].tagName === 'span') {
			    logger.openTag(dataConfig.standard.tag);
			    if (root.childNodes[i].className) {
			        logger.openAttribute(dataConfig.standard.style);
			        logger.write(classToFragStyle(root.childNodes[i].className));
				    logger.closeAttribute(dataConfig.standard.style);
				}
				logger.write(root.childNodes[i].textContent);
				logger.closeTag(dataConfig.standard.tag);
			}
		}
	}
	
	function logToFragments(root, logger) {
	    var dataConfig = dataConfigS.fragments;
		for (var i = 0; i < root.childNodes.length; i++) {
			if (root.childNodes[i].tagName === 'a' && root.childNodes[i].href) {
			    logger.openTag(dataConfig.link.tag);
				logger.openTag(dataConfig.link.text.tag);
			    if (root.childNodes[i].className) {
			        logger.openAttribute(dataConfig.link.style);
			        logger.write(classToFragStyle(root.childNodes[i].className));
				    logger.closeAttribute(dataConfig.link.style);
				}
				logger.write(root.childNodes[i].textContent);
				logger.closeTag(dataConfig.link.text.tag);
				logger.openTag(dataConfig.link.ref.tag);
				logger.write(root.childNodes[i].href);
				logger.closeTag(dataConfig.link.ref.tag);
			    logger.closeTag(dataConfig.link.tag);			    
			} else if (root.childNodes[i].tagName === 'span') {
			    logger.openTag(dataConfig.standard.tag);
			    if (root.childNodes[i].className) {
			        logger.openAttribute(dataConfig.standard.style);
			        logger.write(classToFragStyle(root.childNodes[i].className));
				    logger.closeAttribute(dataConfig.standard.style);
				}
				logger.write(root.childNodes[i].textContent);
				logger.closeTag(dataConfig.standard.tag);
			}
		}
	}
	
	function fragStyleToClass(richStyle) {
	    return richStyle.replace(/_/g, ' ');
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
	    if (! tag) {
		    return;
		}
		if (! hasClass(node, tag)) {
			node.className = (node.className + ' ' + tag).trim();
		}
	}
	
	function removeClass(node, tag) {
        var className = (' ' + node.className + ' ').replace(' ' + tag + ' ', ' ').trim();		
		node.className = className;
	}
	
	function equalClasses(primus, secundus) {
		var pri = primus.className.match(/\S+/g);
		var sec = secundus.className.match(/\S+/g);

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
	
	function removeAllClasses(node) {
	    if (node.nodeType === xtdom.TEXT_NODE) {
		    return;
		} 
		node.removeAttribute('class');
		for (var i = 0; i < node.childNodes.length; i++) {
		    removeAllClasses(node.childNodes[i]);
		}
	}
	
	function closeButtons() {
	    if (_currentInstance) {
			_currentInstance._handle.parentNode.removeChild(_buttons);
			_currentInstance.stopEditing(false);
			_buttons.linkArea.value = 'http://...';
		    _currentInstance.currentLink = null;
			_currentInstance._url = null;
	    } 
	}
	
	var _modal = createModal();
	
	function createModal() {
		  // Creation of a modal to display warnings
	      var div = document.createElement('div'); //xtdom.createElement(instance.getDocument(), 'div');
		  div.setAttribute('class', 'modal');
		  div.style.display = 'none';
	      return div;
	}
	
	function showModal(instance, text) {
	    _modal.textContent = text;
		_modal.style.display = 'block';
		setEditable(instance, 'false')
		instance._handle.appendChild(_modal);
		var width = _modal.style.width;
		var height = _modal.style.height;
		instance._handle.style.position = 'relative';
		var rect = instance._handle.getBoundingClientRect();
		var left = (((rect.right - rect.left) - width) / 2.0) - 90;
		var top = (((rect.bottom - rect.top) - height) / 2.0) - 30;
		_modal.style.position = 'absolute';
		_modal.style.top = top + 'px';
		_modal.style.left = left + 'px';
		xtdom.addEventListener(_modal, 'click', 
		    function(ev) {
			    _modal.style.display='none';
				setEditable(instance, 'true');
			});
	}
	
	var _buttons = createButtons();
	
	var _currentInstance = null;
	
	
	function registerEditor(instance) {
	    _currentInstance = instance;
		//_buttons.linkArea.value = 'http://...';
		instance.buttons = _buttons;
		instance._handle.parentNode.appendChild(_buttons);
	}
	
	function setEditable(instance, value) {
	    xtdom.setAttribute(instance._handle, 'contenteditable', value);
		// For some reason, the paste works only occasionally when the parent node is not
		// set to be content editable.
		xtdom.setAttribute(instance._handle.parentNode, 'contenteditable', value);
	}
	
	function createButtons() {

		  var container = document.createElement('div');//xtdom.createElement(instance.getDocument(), 'span');
		   
		  /*try {
		  container.setAttribute('draggable', 'true');
		  function dragStart(ev) {
		      container.offsetX = parseInt(ev.clientX) - container.style.left;
			  container.offsetY = parseInt(ev.clientY) - container.style.top;
			  ev.dataTransfer.effectsAllowed = "move";
			  ev.dataTransfer.setData('text', "");
			  console.log('start')
			  //console.log(document.outerHTML);
		  }
		  
		  function dragEnd(ev) {
		      console.log('stop')
			  //container.innerHTML = "<span>drop</span>"
		      try {
              //ev.stopPropagation();
			  alert(parseInt(ev.clientX) - container.offsetX)
		      container.style.left = (parseInt(ev.clientX) - container.offsetX) + 'px';
			  container.style.top = (parseInt(ev.clientY) - container.offsetY) + 'px';
			  alert(container.style.left)
			  } catch (e) {console.log(e)}
          }
		  
		  function drop(ev) {
			  console.log('drop')
			  
          }
		  
		  //alert(document.outerHTML);
		  
		  xtdom.addEventListener(container, 'dragstart', function (ev) {dragStart(ev); return false;}, false);
		  xtdom.addEventListener(container, 'dragend', function (ev) {dragEnd(ev)}, false);
		  xtdom.addEventListener(document, 'drop', function(ev) {drop(ev);}, false);
		  
		} catch (e) {alert(e)}
		*/
		  var buttons = document.createElement('span');//xtdom.createElement(instance.getDocument(), 'span');

		  //buttons.setAttribute('style', 'display:none; padding-top:20px;');
          container.setAttribute('class', 'buttons-container');

		  
		  for (var i = 0; i < formatsAndCSS.length; i++) {
		      var button = document.createElement('button');//xtdom.createElement(instance.getDocument(), 'button');
			  button.setAttribute('class', 'button-as-links');
			  var inner = document.createElement('span'); //xtdom.createElement(instance.getDocument(), 'span');
			  var style = formatsAndCSS[i].style;
			  inner.setAttribute('class', style);
			  inner.textContent = formatsAndCSS[i].name;
		      button.appendChild(inner);
		      buttons.appendChild(button);	
			  
			  function callToEnrich(style) {
			      return function() {
					  _currentInstance.enrich(style);
				  };
			  };
			  
              xtdom.addEventListener(button, 'click', callToEnrich(style), false);  
		  }
		  
		  var clearButton = document.createElement('button');//xtdom.createElement(instance.getDocument(), 'button');
		  clearButton.setAttribute('class', 'button-as-links');
		  var inner = document.createElement('span'); //xtdom.createElement(instance.getDocument(), 'span');
		  inner.textContent = 'Clear';
		  clearButton.appendChild(inner);
		  buttons.appendChild(clearButton);	
          xtdom.addEventListener(clearButton, 'click', function() {_currentInstance.clearRange()}, false); 

		  var linkArea = document.createElement('textarea'); //xtdom.createElement(instance.getDocument(), 'textarea');
		  linkArea.setAttribute('class', 'url-box');
		  container.linkArea = linkArea;
		  
		  xtdom.addEventListener(linkArea, 'change', function () {_currentInstance.changeLink(linkArea, this); return false}, false);
		  
		  var makeLinkButton = document.createElement('span'); //xtdom.createElement(instance.getDocument(), 'span');
		  var innerLinkButton = document.createElement('button'); //xtdom.createElement(instance.getDocument(), 'button');
		  innerLinkButton.setAttribute('class', 'button-as-links');
		  innerLinkButton.textContent = 'Link';
		  var innerUnlinkButton = document.createElement('button'); //xtdom.createElement(instance.getDocument(), 'button');
		  innerUnlinkButton.setAttribute('class', 'button-as-links');
		  innerUnlinkButton.textContent = 'Unlink';
		  makeLinkButton.appendChild(innerLinkButton);
		  makeLinkButton.appendChild(document.createTextNode(' / '));
		  makeLinkButton.appendChild(innerUnlinkButton);
		  xtdom.addEventListener(innerLinkButton, 'click', function () {_currentInstance.makeLink(linkArea, true); return false}, false);
		  xtdom.addEventListener(innerUnlinkButton, 'click', function () {_currentInstance.makeLink(linkArea, false); return false}, false);
		  linkArea.value = 'http://...';
		  linkBox = document.createElement('div'); // xtdom.createElement(instance.getDocument(), 'div');
		  linkBox.appendChild(linkArea);
		  linkBox.appendChild(makeLinkButton);
		  buttons.appendChild(linkBox);

		  var toggleButton = document.createElement('button'); //xtdom.createElement(instance.getDocument(), 'span');
		  toggleButton.setAttribute('class', 'button-as-links');
		  toggleButton.textContent = 'Close';
		  buttons.toggleButton = toggleButton;
		  
		  xtdom.addEventListener(toggleButton, 'click', function () {closeButtons();}, false); 
		  
		  
		  container.appendChild(buttons);
		  container.appendChild(toggleButton);

		  return container;
		}

    return {

      ////////////////////////
      // Life cycle methods //
      ////////////////////////

      onInit : function ( aDefaultData, anOptionAttr, aRepeater ) {
		if (this.getParam('lang') === 'span') {
		    var data = extractSpanContentXT(aDefaultData);
		} else {
		    var data = extractFragmentContentXT(aDefaultData);
		}
	    var data = normalize(data, this.getDocument());
        if (! data) { 
          this._content = '<span>Click to edit</span>'; // should make a function to ensure proper structure of the content
        } else {
		  this._content = data.cloneNode(true);
		}
        this._setData(data);	
        if (this.getParam('hasClass')) {
          xtdom.addClassName(this._handle, this.getParam('hasClass'));
        }
        this.keyboard = xtiger.session(this.getDocument()).load('keyboard');
        this.editInProgress = false;
      },

      // Awakes the editor to DOM's events, registering the callbacks for them
      onAwake : function () {
        var _this = this;
        if (this.getParam('noedit') !== 'true') {
          xtdom.addClassName(this._handle, 'axel-core-editable');
          // 'mousedown' always preceeds 'focus', saves shiftKey timestamp to detect it in forthcoming 'focus' event
          xtdom.addEventListener(this._handle, 'mousedown', function(ev) { if (ev.shiftKey) { _timestamp = new Date().getTime(); } }, true);
          // tracks 'focus' event in case focus is gained with tab navigation  (no shiftKey)
		  this.setListeners();
          /*if (xtiger.cross.UA.gecko) {  // gecko: prevent browser from selecting contentEditable parent in triple clicks ! 
            xtdom.addEventListener(this._handle, 'mousedown', function(ev) { if (ev.detail >= 3) { xtdom.preventDefault(ev);xtdom.stopPropagation(ev);_this._handle.focus();_focusAndSelect(_this); } }, true);
          }
          if (xtiger.cross.UA.webKit) {
            this.doSelectAllCb = function () { _focusAndSelect(_this); }; // cache function
          }*/
          // TODO: instant paste cleanup by tracking 'DOMNodeInserted' and merging each node inserted ?
        }
        this.blurHandler = function (ev) { _this.handleBlur(ev); };
      },

      onLoad : function (aPoint, aDataSrc) {
        var _value, _default;
        if (aPoint !== -1) { 
          _value = normalize(aPoint[0], this.getDocument());
          _default = this.getDefaultData();
          defval = _value || _default;
          this._setData(defval);
          this.setModified(_value !==  _default);
          this.set(false);
        } else {
          this.clear(false);
        }
      },

      onSave : function (aLogger) {

        if (this.isOptional() && (!this.isSet())) {
          aLogger.discardNodeIfEmpty();
          return;
        }
	    if (this._handle && this.getParam('lang') === 'span') {
		    logToSpans(this._handle, aLogger);
		} else {
		    logToFragments(this._handle, aLogger);
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
		
		  while (this._handle.firstChild) {
		      this._handle.removeChild(this._handle.firstChild);
		  }
		  while (aData.firstChild) {
		      this._handle.appendChild(aData.firstChild);
		  }
		  
          this.model = aData;
		  
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
		
		setListeners : function () {
		    var _this = this;
		    for (var i = 0; i < this._handle.children.length; i++) {
		        var child = this._handle.children[i];
                xtdom.addEventListener(child, 'click', function(ev) {  _this.clickedFrag(ev); return false;}, true);
			    xtdom.addEventListener(child, 'paste', function(ev) {  _this.interceptPaste(ev, child);}, true);
		    }
		},
		
		interceptPaste : function (event, node) {

			event.preventDefault();
			
			var winText = window.clipboardData ? window.clipboardData.getData("Text") : "";
			var eventText = event.clipboardData ? event.clipboardData.getData('text') : "";
			if (eventText) {
			    var content = eventText;
			} else {
				var content = winText;
			}

			var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

			var newNode = xtdom.createElement(this.getDocument(), 'span');
			newNode.innerHTML = content;

			range.insertNode(newNode)
	        
			var parent = newNode.parentNode;
			parent.innerHTML = innerText(parent);
			
			return false;  

            /*			
			
			var winText = window.clipboardData ? window.clipboardData.getData("Text") : "";
			var eventText = event.clipboardData ? event.clipboardData.getData('text') : "";
			if (eventText) {
			    var content = eventText;
			} else {
				var content = winText;
			}
			
			try {
		    var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);
			
			} catch (e) {
			    alert(e)
			}

			var newNode = xtdom.createElement(this.getDocument(), 'span');
			newNode.innerHTML = content;

			range.insertNode(newNode)
		
		    var store = this._handle.innerHTML;
			this._handle.innerHTML = store;
			var _this = this;			
			setTimeout(function() {_this.regularizePaste(store)}, 2);*/
			
		},
		
	    cleanTree : function (target, current) {
			var prev = current.firstChild;
			target.appendChild(prev);
		
			while (current.firstChild) {
				if (prev.className === "") {
					prev.removeAttribute("class");
				}
				if (equalClasses(prev, current.firstChild) && equalTags(prev, current.firstChild)) {
					prev.innerHTML = prev.innerHTML + current.firstChild.innerHTML;
					current.removeChild(current.firstChild);
				} else if (current.firstChild.innerHTML === "") {
					current.removeChild(current.firstChild);
				} else {
					prev = current.firstChild;
					target.appendChild(prev);
					var _this = this;
					xtdom.addEventListener(prev, 'click', function(ev) {  _this.startEditing(ev); }, true);
				}
			}
			this.setListeners();
		},
		
        recreateTree : function (root, mainTag, allTagged, inherit, style) {
		
			var tempRoot = xtdom.createElement(this.getDocument(), 'span');	
			alert(root.outerHTML)
			while (root.firstChild) {
				if (root.firstChild.firstChild) {
					while (root.firstChild.firstChild) {
						var href = inLink(root.firstChild.firstChild);
						var tag = href ? 'a' : 'span';	
						if (root.firstChild.firstChild.nodeType === xtdom.TEXT_NODE) {			
							var newFrag = xtdom.createElement(this.getDocument(), tag); // xtdom...
							if (href) {
								newFrag.setAttribute('href', href);
							}
							addClass(newFrag, root.firstChild.className);
							newFrag.appendChild(root.firstChild.firstChild);
							tempRoot.appendChild(newFrag);
						} else {
							if (mainTag === 'a' || href) {
								var cur = xtdom.createElement(this.getDocument(), 'a'); // xtdom...
								cur.innerHTML = root.firstChild.firstChild.innerHTML;
								cur.setAttribute('href', href);
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className);
								root.firstChild.removeChild(root.firstChild.firstChild);
							} else {
								var cur = xtdom.createElement(this.getDocument(), 'span'); // xtdom...
								cur.innerHTML = root.firstChild.firstChild.innerHTML;
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className);
								root.firstChild.removeChild(root.firstChild.firstChild);
							}
							
							if (!allTagged && !inherit) {
								addClass(cur, style);
							} else {
								removeClass(cur, style); // is this ever used ??
								//cur.className = undefined;
							}
							tempRoot.appendChild(cur);
						}
					}
				} else {
					tempRoot.appendChild(root.firstChild);
				} 
			}
			alert(tempRoot.outerHTML)
			return tempRoot;
		},
		
		/*regularizePaste : function (node, storedHandle) {
		    try {
		    //alert(node.outerHTML)
			alert(this._handle.parentNode.outerHTML)
			var text = xtdom.createTextNode(this.getDocument(), innerText(node));
			while (node.firstChild) {
			    node.removeChild(node.firstChild);
			}
			node.appendChild(text);
			} catch (e) {alert(e)}
		
		    this._handle = storedHandle;
			
			//alert(this._handle.outerHTML)
		    

			var root = xtdom.createTextNode(this.getDocument(), span);
			root.innerHTML = store;
			
			if (inLink(newNode)) {
			    var mainTag = 'a';
			} else {
			    var mainTag = 'span';
			}
			
			var style = "";
			var allTagged = false;
			var inherit = false;
			var url = "";
			
			var tempRoot = this.recreateTree(root, mainTag, allTagged, inherit, style, "");
			
			this._handle.innerHTML = "";
			
			this.cleanTree(this._handle, tempRoot);
			
			alert(this._handle.outerHTML)
			
	    },*/
		
		makeLink : function (urlNode, link) {
		    var url = urlNode.value;
			if (url.indexOf('http://') != 0 && url.indexOf('https://') != 0) {
			    url = 'http://' + url;
			}
			
			if (link && ! url.match(urlPattern)) {
			    showModal(this, 'Choose a valid url.');
			    return;
			}
			
			var mainTag = 'a';
			
            var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);
			var newNode = xtdom.createElement(this.getDocument(), mainTag);
			var content = range.extractContents()
			newNode.appendChild(content)
			range.insertNode(newNode)
			
			var root = this._handle;

			newNode.setAttribute('href', url);	
			
			var style = "";
			var allTagged = false;
			var inherit = false;
			
			var tempRoot = this.recreateTree(root, mainTag, allTagged, inherit, style);
			
			this._handle.innerHTML = "";
			
			this.cleanTree(this._handle, tempRoot);
		},
		
		changeLink : function (linkArea) {
		    if (this.currentLink && linkArea.value.match(urlPattern)) {
			    this.currentLink.href = linkArea.value;
			}
		},
		
		clearRange : function () {

            var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

			var newNode = xtdom.createElement(this.getDocument(), 'span');
			var content = range.extractContents()
			newNode.appendChild(content)
			
			range.insertNode(newNode);

			var root = this._handle;		
			
			if (inLink(newNode)) {
			    var mainTag = 'a';
			} else {
			    var mainTag = 'span';
			}
			
			var allTagged = false;
			var inherit = false;
			var style = "";
			var url = "";
			
		    removeAllClasses(newNode);
			
			var tempRoot = this.recreateTree(root, mainTag, allTagged, inherit, style, url);
			
			this._handle.innerHTML = "";
			
			this.cleanTree(this._handle, tempRoot);
		},
		
		enrich : function (style) {

		    //alert(this._handle.outerHTML)
            var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

			var newNode = xtdom.createElement(this.getDocument(), 'span');
			var content = range.extractContents()
			newNode.appendChild(content)
			
			range.insertNode(newNode);

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
			
			if (inLink(newNode)) {
			    var mainTag = 'a';
			} else {
			    var mainTag = 'span';
			}
			
			var url = "";
			
			var tempRoot = this.recreateTree(root, mainTag, allTagged, inherit, style, url);
			
			this._handle.innerHTML = "";
			
			this.cleanTree(this._handle, tempRoot);

		},
		
		clickedFrag : function (ev) {
		    ev.preventDefault();
			var target = xtdom.getEventTarget(ev);
			var tag = xtdom.getLocalName(target);
			if (tag.toUpperCase() === 'A') {
			    _buttons.linkArea.value = target;
				this.currentLink = target;
			} else {
			    //_buttons.linkArea.value = 'http://...';
				this.currentLink = null;
			}
		    if (ev && this.editInProgress === false) {
			   this.startEditing(ev);
			} 
		},
		

        // Starts editing the field (to be called once detected)
        startEditing : function (ev) {
		   if (ev && this.editInProgress == false) {
			  var target = xtdom.getEventTarget(ev);
			  var tag = xtdom.getLocalName(target);
			  if (tag.toUpperCase() === 'A') { // clicked on a link
				xtdom.preventDefault(ev);
				xtdom.stopPropagation(ev); // prevents link opening
				var popupdevice = _getPopupDevice(this.getDocument());
				this._url = target.href;
				popupdevice.startEditing(this, ['edit', 'open'], 'edit', target);
			  } else {
			     this.__open__editor();
			  }
		   } 
		   
		}, 
		   
		__open__editor : function () {
          if (this.editInProgress === false) {
            this.editInProgress = true;
			registerEditor(this);
            // registers to keyboard events
            this.kbdHandlers = this.keyboard.register(this, this._handle);
            this.keyboard.grab(this, this);
			if (this.getParam('multilines') == 'normal') {
                this.keyboard.enableRC(true);
            }
    //        xtdom.removeClassName(this._handle, 'axel-core-editable');
            /*if ((!this.isModified()) || ((_timestamp !== -1) && ((_timestamp - new Date().getTime()) < 100))) {
              if (xtiger.cross.UA.webKit) {
                // it seems on webkit the contenteditable will really be focused after callbacks return
                setTimeout(this.doSelectAllCb, 100);
              } else {
                _focusAndSelect(this); 
              }
            }*/
            // must be called at the end as on FF 'blur' is triggered when grabbing
            xtdom.addEventListener(this._handle, 'blur', this.blurHandler, false);
          }
        },
		
      onMenuSelection: function onMenuSelection (aSelection) {
        if (aSelection == 'edit') {
          this.__open__editor();
        } else if (aSelection == 'open') {
          // opens this.cachedURL in an external window
          window.open(this._url);
        }
      },

        // Stops the edition process on the device
        stopEditing : function (isCancel) {
          if ((! this.stopInProgress) && (this.editInProgress !== false)) {
            this.stopInProgress = true;
            _timestamp = -1;
            this.keyboard.unregister(this, this.kbdHandlers);
            this.keyboard.release(this, this);
            xtdom.removeEventListener(this._handle, 'blur', this.blurHandler, false);
            if (!isCancel) {
              // user may have deleted all
              // FIXME: we should also normalize in case of a paste that created garbage (like some <br/>)
              this.update(this._handle.firstChild ? this._handle.firstChild.data : null);
            } else {
              // restores previous data model - do not call _setData because its like if there was no input validated
              if (this._handle.firstChild) {
                this._handle.firstChild.data = this.model;
              }
            }
            this._handle.blur();
    //        xtdom.addClassName(this._handle, 'axel-core-editable');
            this.stopInProgress = false;
            this.editInProgress = false;

          }
		  
		  setEditable(this, 'false')
		  
		  if (/^\s*$/.test(innerText(this._handle))) {
		      this._setData(this.getDefaultData());
		  }
		  
        },

        // Updates the editor data model with the given data
        // This gives a chance to normalize the input
        update : function (aData) { 
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