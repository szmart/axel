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
	
	var urlPattern = new RegExp(/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,}\.[a-z]{2,}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi);

    var _timestamp = -1;
	
	/* The format names as displayed on the buttons and their corresponding CSS span.class*/
	var formatsAndCSS = [ 
		{name : 'Bold', style : 'bold'},
		{name : 'Italics', style : 'italics'},
	    {name : 'Underline', style : 'underline'},
		{name : 'Strike', style : 'line-through'}
	];
	
	function _formats() {
	    var ret = []
	    for (var i = 0; i < formatsAndCSS.length; i++) {
		    ret.push(formatsAndCSS[i].style);
		}
		return ret;
	}
	
	var allowedCSS = _formats();
	
	var dataConfigS = {
	    spans : {
	        link : {tag: 'a', ref : 'href', style: 'class'},
		    standard : {tag: 'span', style: 'class'}
	    },
	    fragments : {
	        link : {tag: 'Link', ref : 'Ref', style: 'RichStyle'},
		    standard : {tag: 'Fragment', style: 'RichStyle'}
	    }
    }		
	
	dataConfig = dataConfigS['spans'];
	
	var _getPopupDevice = function (aDocument) {
	   var devKey = 'popupdevice';
	   var device = xtiger.session(aDocument).load(devKey);
	   if (! device) {  // lazy creation
		 device = new xtiger.editor.PopupDevice (aDocument); // hard-coded device for this model
		 xtiger.session(aDocument).save(devKey, device);
	   }
	   return device;
    };

    function _focusAndSelect ( editor ) {
      // pre-condition: the editor's handle must already have focus
      try {
        editor.getDocument().execCommand('selectAll', false, ''); // FIXME: fails on iPad
      }
      catch (e) { }
    }

    // Checks node contains only a text node, otherwise recreate it
    // (this can be used to prevent cut and paste side effects)
    function _sanitize (pasteHTML, doc) {
	  var span = xtdom.createElement(doc, 'span');
	  span.innerHTML = pasteHTML;
      return innerText(span);
	  
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
	  
	  if (node.childNodes) {
	    var root = document.createElement('span');
		var cur;
		while (node.firstChild) {
		    cur = node.firstChild;
			if (cur.nodeType === xtdom.ELEMENT_NODE && cur.tagName === dataConfig.standard.tag) {
			    var span = document.createElement('span');
				span.innerHTML = innerText(node.firstChild);
				var style = cur.getAttribute(dataConfig.standard.style);
				if (style && allowedCSS.indexOf(style) !== -1) {
				    span.setAttribute('class', style);
				}
				node.removeChild(node.firstChild);
				root.appendChild(span);			
			} else 	if (cur.nodeType === xtdom.ELEMENT_NODE && cur.tagName === dataConfig.link.tag) {
			    var a = document.createElement('a');
				a.setAttribute('href', cur.getAttribute(dataConfig.link.ref));
				a.innerHTML = innerText(node.firstChild);
				var style = cur.getAttribute(dataConfig.link.style);
				if (style && allowedCSS.indexOf(style) !== -1) {
				    a.setAttribute('class', style);
				}
				node.removeChild(node.firstChild);
				root.appendChild(a);			
			} else {
			    node.removeChild(node.firstChild);
			}
		}
	  } else {
	    var root = document.createElement('span');
		root.innerHTML = innerText(node);
	  }
	  
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
			if (root.childNodes[i].tagName === 'a' && root.childNodes[i].href) {
			    logger.openTag(dataConfig.link.tag);
				//logger.openTag('LinkText');
			    if (root.childNodes[i].className) {
			        logger.openAttribute(dataConfig.link.style);
			        logger.write(classToFragStyle(root.childNodes[i].className));
				    logger.closeAttribute(dataConfig.link.style);
				}
				//logger.closeTag('LinkText');
				//logger.openTag('LinkRef');
				logger.openAttribute(dataConfig.link.ref);
				logger.write(root.childNodes[i].href);
				//logger.closeTag('LinkRef');
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
	
	function fragStyleToClass(richStyle) {
	    return richStyle.replace(/_/g, ' ');
	}
	
	function fragsToSpans(frags, doc) { // we should try to take into account ill-formed fragments...
	    var root = xtdom.createElement(doc, 'span');
		for (var i = 0; i < frags.childNodes.length; i++) {
		    if (frags.childNodes[i].nodeType === Node.ELEMENT_NODE && frags.childNodes[i].tagName.toLowerCase() == 'fragment')  {
			    var span = xtdom.createElement(doc, 'span');
				if (frags.childNodes[i].getAttribute('RichStyle')) {
				    var style = frags.childNodes[i].getAttribute('RichStyle');
				    xtdom.addClassName(span, fragStyleToClass(style));
				}
				var text = xtdom.createTextNode(doc, frags.childNodes[i].textContent);
				span.appendChild(text);
				root.appendChild(span);
		    } 
		}
		return root;
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
	
	function toggleButtons() {
	    if (_currentInstance.editInProgress) {
			_currentInstance._handle.parentNode.removeChild(_buttons);
			_currentInstance.stopEditing(false);
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
		xtdom.setAttribute(instance._handle, 'contenteditable', 'false');
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
				xtdom.setAttribute(instance._handle, 'contenteditable', 'true');
			});
	}
	
	var _buttons = createButtons();
	
	var _currentInstance = null;
	
	
	function registerEditor(instance) {
	    _currentInstance = instance;
		_buttons.linkArea.value = 'http://...';
		_currentInstance._handle.parentNode.appendChild(_buttons);
	}
	
	function createButtons() {
		
		  var container = document.createElement('div');//xtdom.createElement(instance.getDocument(), 'span');
		  /*container.setAttribute('draggable', 'true');
		  function dragStart(ev) {
		      container.offsetX = parseInt(ev.clientX) - container.style.left;
			  container.offsetY = parseInt(ev.clientY) - container.style.top;
			  ev.dataTransfer.effectsAllowed = "copy";
			  ev.dataTransfer.setData('text/html', this.innerHTML);
			  console.log('start')
		  }
		  
		  function dragover(ev) {
		      console.log('over')
			  //container.innerHTML = "<span>drop</span>"
		      try {
              //ev.stopPropagation();
		      //container.style.right = parseInt(ev.clientX) - container.offsetX;
			  //container.style.top = parseInt(ev.clientY) - container.offsetY;
			  } catch (e) {console.log(e)}
          }
		  
		  function drop(ev) {
			  console.log('drop')
			  
          }
		  xtdom.addEventListener(container, 'dragstart', function (ev) {dragStart(ev);return false;}, false);
		  xtdom.addEventListener(container, 'dragover', function (ev) {dragover(ev);}, false);
		  xtdom.addEventListener(container, 'drop', function(ev) {drop(ev);}, false);
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
		  

		  var linkArea = document.createElement('textarea'); //xtdom.createElement(instance.getDocument(), 'textarea');
		  linkArea.setAttribute('class', 'url-box');
		  container.linkArea = linkArea;
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
		  
		  xtdom.addEventListener(toggleButton, 'click', function () {_currentInstance.stopEditing(false);}, false); 
		  
		  
		  container.appendChild(buttons);
		  container.appendChild(toggleButton);
		  
		  return container;
		}

    return {

      ////////////////////////
      // Life cycle methods //
      ////////////////////////

      onInit : function ( aDefaultData, anOptionAttr, aRepeater ) {
	    var data = normalize(aDefaultData, this.getDocument());
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
	    xtdom.addClassName(this._handle, 'axel-core-editable');
        var _this = this;
        if (this.getParam('noedit') !== 'true') {
          xtdom.setAttribute(this._handle, 'contenteditable', 'true');
          xtdom.addClassName(this._handle, 'axel-core-editable');
          // 'mousedown' always preceeds 'focus', saves shiftKey timestamp to detect it in forthcoming 'focus' event
          xtdom.addEventListener(this._handle, 'mousedown', function(ev) { if (ev.shiftKey) { _timestamp = new Date().getTime(); } }, true);
          // tracks 'focus' event in case focus is gained with tab navigation  (no shiftKey)
		  for (var i = 0; i < this._handle.childNodes.length; i++) {
              xtdom.addEventListener(this._handle.childNodes[i], 'click', function(ev) {  _this.startEditing(ev); }, true);
		  }
          if (xtiger.cross.UA.gecko) {  // gecko: prevent browser from selecting contentEditable parent in triple clicks ! 
            xtdom.addEventListener(this._handle, 'mousedown', function(ev) { if (ev.detail >= 3) { xtdom.preventDefault(ev);xtdom.stopPropagation(ev);_this._handle.focus();_focusAndSelect(_this); } }, true);
          }
          if (xtiger.cross.UA.webKit) {
            this.doSelectAllCb = function () { _focusAndSelect(_this); }; // cache function
          }
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
        if (this._handle) {
	      logSpansToFragments(this._handle, aLogger);
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
		
		interceptPaste : function (event) {
		
			var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);
			
		    var winText = window.clipboardData ? window.clipboardData.getData("Text") : "";
			var eventText = event.clipboardData ? event.clipboardData.getData('text') : "";
			if (eventHTML) {
			    var content = eventText;
			} else {
				var content = winText;
			}

			var newNode = xtdom.createElement(this.getDocument(), 'span');
			newNode.innerHTML = content;

			range.insertNode(newNode)
		
		    var store = this._handle.innerHTML;
			this._handle.innerHTML = store;
			var _this = this;			
			setTimeout(function() {_this.regularizePaste(store)}, 2);
			
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
		},
		
		regularizePaste : function (store) {
			
			var root = xtdom.createElement(this.getDocument(), 'span');
			root.innerHTML = store;
			
			var tempRoot = xtdom.createElement(this.getDocument(), 'span');
			
			while (root.firstChild) {
			    if (root.firstChild.firstChild) {
				    while (root.firstChild.firstChild) {
					    if (root.firstChild.firstChild.nodeType === xtdom.TEXT_NODE) {		
                            var tag = root.firstChild.tagName;							
						    var newFrag = xtdom.createElement(this.getDocument(), tag); // xtdom...
							if (tag === 'a') {
							    newFrag.setAttribute('href', root.firstChild.href);	
							}
							addClass(newFrag, root.firstChild.className);
							addClass(newFrag, root.firstChild.firstChild.className); // is there any class name in this case ??
							newFrag.appendChild(root.firstChild.firstChild);
							tempRoot.appendChild(newFrag);
						} else {
						    if (root.firstChild.firstChild.tagName in ['a', 'span']) {								
								var cur = root.firstChild.firstChild;
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className);
							} else {
							    var tag = root.firstChild.tagName;
							    var cur = xtdom.createElement(this.getDocument(), tag);
								cur.innerHTML = root.firstChild.firstChild.innerHTML;
								if (tag === 'a') {
								    cur.setAttribute('href', root.firstChild.href);
								}
								addClass(cur, root.firstChild.className);
								addClass(cur, root.firstChild.firstChild.className);
								root.firstChild.removeChild(root.firstChild.firstChild);							    
							}
						    tempRoot.appendChild(cur);
						}
					}
				} else {
				    tempRoot.appendChild(root.firstChild);
				} 
			}
			
			this._handle.innerHTML = "";
			
			this.cleanTree(this._handle, tempRoot);
			
	    },
		
		makeLink : function (urlNode, link) {
		    var url = urlNode.value;
			if (url.indexOf('http://') != 0 && url.indexOf('https://') != 0) {
			    url = 'http://' + url;
			}
			
			if (link && ! url.match(urlPattern)) {
			    showModal(this, 'Choose a valid url.');
			    return;
			}
			
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
			range.insertNode(newNode)
			
			var root = this._handle;
			
			var tempRoot = xtdom.createElement(this.getDocument(), 'span');			

			while (root.firstChild) {
			    if (root.firstChild.firstChild) {
				    while (root.firstChild.firstChild) {
					    if (root.firstChild.firstChild.nodeType === xtdom.TEXT_NODE) {		
                            var tag = root.firstChild.tagName;						
						    var newFrag = xtdom.createElement(this.getDocument(), tag);
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
			
			this._handle.innerHTML = "";
			
			this.cleanTree(this._handle, tempRoot);
		},
		
		/*
		A normalized tree should be made of a root containing a list of paragraphs, 
		containing a list of lines, containing a list of fragments or links.
		
		*/
		
		
		enrich : function (style) {

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
			
			var tempRoot = xtdom.createElement(this.getDocument(), 'span');	
			
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
							}
							if (!allTagged && !inherit) {
							    addClass(cur, style);
							} else {
							    removeClass(cur, style);
							}
							tempRoot.appendChild(cur);
						}
					}
				} else {
				    tempRoot.appendChild(root.firstChild);
				} 
			}
			
			this._handle.innerHTML = "";
			
			this.cleanTree(this._handle, tempRoot);
		},
		

        // Starts editing the field (to be called once detected)
        startEditing : function (optMouseEvent) {
		   var _target, _tname;
		   if (optMouseEvent && this.editInProgress==false) {
			  _target = xtdom.getEventTarget(optMouseEvent);
			  _tname = xtdom.getLocalName(_target);
			  if (_tname.toUpperCase() === 'A') { // clicked on a link
				xtdom.preventDefault(optMouseEvent);
				xtdom.stopPropagation(optMouseEvent); // prevents link opening
				var _popupdevice = _getPopupDevice(this.getDocument());
				this._url = _target.getAttribute('href'); // stores the url to follow
				if ((!this._url) || (this._url == '')) {
				  this._url = _target.getAttribute('HREF');
				}
				_popupdevice.startEditing(this, ['edit', 'open'], 'edit', _target);
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
            this.kbdHandlers = this.keyboard.register(this);
            this.keyboard.grab(this, this);
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
            //_sanitize(this._handle, this.doc);
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
             
			 _currentInstance._handle.parentNode.removeChild(_buttons);
			 //_currentInstance.stopEditing(false);

          }
		  
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