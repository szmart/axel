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
	
	function toggleButtons(instance) {
	    if (instance.editInProgress) {
		    instance.modal.style.display = 'none';
		    instance.stopEditing();
	    } else if (instance.getParam('noedit') !== 'true') {
          xtdom.setAttribute(instance._handle, 'contenteditable', 'true');
          _timestamp = new Date().getTime();
		  instance._handle.addEventListener('paste', function (ev) {instance.interceptPaste(ev); return false;})
		  instance.startEditing();
        }
	}
	
	function showModal(instance, text) {
	    var modal = instance.modal;
	    modal.textContent = text;
		modal.style.display = 'block';
		xtdom.setAttribute(instance._handle, 'contenteditable', 'false');
		instance._handle.appendChild(modal);
		var width = modal.style.width;
		var height = modal.style.height;
		instance._handle.style.position = 'relative';
		var rect = instance._handle.getBoundingClientRect();
		var left = (((rect.right - rect.left) - width) / 2.0) - 90;
		var top = (((rect.bottom - rect.top) - height) / 2.0) - 30;
		modal.style.position = 'absolute';
		modal.style.top = top + 'px';
		modal.style.left = left + 'px';
		xtdom.addEventListener(modal, 'click', 
		    function(ev) {
			    modal.style.display='none';
				xtdom.setAttribute(instance._handle, 'contenteditable', 'true');
			});
	}

    return {

      ////////////////////////
      // Life cycle methods //
      ////////////////////////

      onInit : function ( aDefaultData, anOptionAttr, aRepeater ) {
	    var data = normalize(aDefaultData, this.getDocument());
        if (! data) { 
          this._content = '<span>Click to edit</span>'; // should make a function to ensure proper structure of the content
        }
        this._setData(data);	
        if (this.getParam('hasClass')) {
          xtdom.addClassName(this._handle, this.getParam('hasClass'));
        }
        this.keyboard = xtiger.session(this.getDocument()).load('keyboard');
        this.editInProgress = false;
		this.createButtons();
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
          _value = fragsToSpans(aPoint[0], this.getDocument());
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
			
		    var win = window.clipboardData ? window.clipboardData.getData("Text") : "";
            var eventHTML = event.clipboardData ? event.clipboardData.getData('text/html') : "";
			var eventText = event.clipboardData ? event.clipboardData.getData('text') : "";
			if (eventHTML) {
			    var content = _sanitize(eventHTML, this.getDocument());
			} else {
				var content = eventText;
			}

			var newNode = xtdom.createElement(this.getDocument(), 'span');
			newNode.innerHTML = content;

			range.insertNode(newNode)
		
		    var store = this._handle.innerHTML;
			this._handle.innerHTML = store;
			var _this = this;			
			setTimeout(function() {_this.regularizePaste(store)}, 2);
			
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
			
			var prev = tempRoot.firstChild;
			this._handle.appendChild(prev);
			
			while (tempRoot.firstChild) {
				if (prev.className === "") {
				    prev.removeAttribute("class");
				}
			    if (equalClasses(prev, tempRoot.firstChild) && equalTags(prev, tempRoot.firstChild)) {
				    prev.innerHTML = prev.innerHTML + tempRoot.firstChild.innerHTML;
					tempRoot.removeChild(tempRoot.firstChild);
				} else if (tempRoot.firstChild.innerHTML === "") {
				    tempRoot.removeChild(tempRoot.firstChild);
				} else {
				    prev = tempRoot.firstChild;
				    this._handle.appendChild(prev);
				}
			}
			
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
			
			var prev = tempRoot.firstChild;
			root.appendChild(prev);
			
			while (tempRoot.firstChild) {
				if (prev.className === "") {
				    prev.removeAttribute("class");
				}
			    if (equalClasses(prev, tempRoot.firstChild) && equalTags(prev, tempRoot.firstChild)) {
				    prev.innerHTML = prev.innerHTML + tempRoot.firstChild.innerHTML;
					tempRoot.removeChild(tempRoot.firstChild);
				} else if (tempRoot.firstChild.innerHTML === "") {
				    tempRoot.removeChild(tempRoot.firstChild);
				} else {
				    prev = tempRoot.firstChild;
				    root.appendChild(prev);
				}
			}
		},
		
		enrich : function (style) {

            var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

			var newNode = xtdom.createElement(this.getDocument(), 'span');
			var content = range.extractContents()
			newNode.appendChild(content)
			
			newNode.setAttribute('data-mark', 'new') 
			
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
			
			var prev = tempRoot.firstChild;
			root.appendChild(prev);
			
			while (tempRoot.firstChild) {
				if (prev.className === "") {
				    prev.removeAttribute("class");
				}
			    if (equalClasses(prev, tempRoot.firstChild) && equalTags(prev, tempRoot.firstChild)) {
				    prev.innerHTML = prev.innerHTML + tempRoot.firstChild.innerHTML;
					tempRoot.removeChild(tempRoot.firstChild);
				} else if (tempRoot.firstChild.innerHTML === "") {
				    tempRoot.removeChild(tempRoot.firstChild);
				} else {
				    prev = tempRoot.firstChild;
				    root.appendChild(prev);
				}
			}
		},
		
		createButtons : function () {
		
		  var container = xtdom.createElement(this.getDocument(), 'spanf');
		
		  var buttons = xtdom.createElement(this.getDocument(), 'span');

		  buttons.setAttribute('style', 'display:none; padding-top:20px;');	  
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
		  this.linkArea = linkArea;
		  var makeLinkButton = xtdom.createElement(this.getDocument(), 'span');
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
		  linkBox.appendChild(linkArea);
		  linkBox.appendChild(makeLinkButton);
		  buttons.appendChild(linkBox);

		  var toggleButton = xtdom.createElement(this.getDocument(), 'span');
		  toggleButton.setAttribute('style', 'float:right;');
		  toggleButton.setAttribute('class', 'edit-button');
		  toggleButton.textContent = 'Edit';
		  this.toggleButton = toggleButton;
		  
		  xtdom.addEventListener(toggleButton, 'click', function () {toggleButtons(_this);}, false); 
		  
		  container.appendChild(toggleButton);
		  container.appendChild(buttons);
		  
		  this._handle.parentNode.insertBefore(container, this._handle.nextSibling);
		  
		  // Creation of a modal to display warnings
	      var div = xtdom.createElement(this.getDocument(), 'div');
		  div.setAttribute('class', 'modal');
		  div.style.display = 'none';
		  this.modal = div;
	 
		},
		

        // Starts editing the field (to be called once detected)
        startEditing : function () {
		  if (this.editInProgress) {
		      return;
		  }

		  var _this = this;
		  		  
		  this.editInProgress = true;		  
		  this.buttonBox.style.display = 'block';
		  this.toggleButton.textContent = 'Close';
		  this.linkArea.value = 'http://...';

          this.kbdHandlers = this.keyboard.register(this);
          this.keyboard.grab(this, this);
          if ((!this.isModified()) || ((_timestamp !== -1) && ((_timestamp - new Date().getTime()) < 100))) {
               xtdom.addEventListener(this._handle, 'blur', this.blurHandler, false);
          }
        },

        // Stops the edition process on the device
        stopEditing : function (isCancel) {
          if ((! this.stopInProgress) && (this.editInProgress !== false)) {
            this.stopInProgress = true;
			this.buttonBox.style.display = 'none';
			this.toggleButton.textContent = 'Edit';
			xtdom.setAttribute(this._handle, 'contenteditable', 'false');
            _timestamp = -1;
            this.keyboard.unregister(this, this.kbdHandlers);
            this.keyboard.release(this, this);
            this.stopInProgress = false;
            this.editInProgress = false;
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