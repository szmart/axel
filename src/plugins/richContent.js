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

	/*
	 Creates the editor's handle. By default, the handle will be a `span', but
	 other choices are possible, such as `pre' if the multilines option is
	 defined in the parameters.	 
	*/
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
		aContainer.appendChild(handle);
		return handle;
	};

	// Uses a closure to store class level private utility properties and functions
	var _Editor = (function () {
        
		/*
		  The regex pattern used to define a valid URL.
		*/
		var urlPattern = new RegExp(/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,}\.[a-z]{2,}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi);
		
		/*
		  Creates a default content to fill the editable area in case no other
		  content is provided.
		*/
		var _defaultText = 'Click to edit';
		var _defaultContent = document.createElement('span');
		_defaultContent.textContent = _defaultText;

		/* 
		  The default format names as displayed on the buttons and their corresponding CSS classes.
		*/
		var formatsAndCSS = [
			{name : 'Bold', style : 'bold'},
			{name : 'Italics', style : 'italics'},
			{name : 'Underline', style : 'underline'},
			{name : 'Strike', style : 'line-through'}
		];
		
        /*
		  The default structure of the data to be loaded and saved. three main structures are defined. 
		  
		  In the html-like structure, links are represented as nodes (by default with a
		  `a' tag) parents to some text content and bearing a target attribute (by default, a
		  `href'). The other elements are spans.
		  
		  In the `fragment' case, links are parents to two nodes: a `text'-tagged node 
		  containing some text child, and a `ref' child containing the target url. The
		  other nodes have tagged corresponding to the `standard' attribute. The link.text and
          the standard nodes can be qualified by a style attribute.
		  
		  The `semantic' structure is to be defined by the user with its own categories. The node 
		  tags themselves will serve as formats (provided they are among the allowed CSS recognized
		  by the editor). The links assume a pattern similar to the fragment-type links.
		  
          The structure defined here-below, as well as in formatsAndCSS, represent the default
		  choices. The user can redefine them in the associated file richcontentparams.js (quae
          uide).
        */  		  
		var dataStructure = {
			html : {
				link : {tag : 'a', ref : 'href', style : 'class'},
				standard : {tag : 'span', style : 'class'}
			},
			fragments : {
				link : {tag : 'Link', ref : {tag : 'LinkRef'}, text : {tag : 'LinkText', style : 'RichStyle'}},
				standard : {tag : 'Fragment', style : 'RichStyle'}
			},
			semantic : {
				link : {tag : 'Link', ref : {tag : 'LinkRef'}, text : {standard : 'LinkText'}},
				standard : {tag : 'Text'}
			}
		}

        /*
		 Extracts the formats used by the editor, as defined in formatsAndCSS
		*/
		function _formats(formatsAndCSS) {
			var ret = [];
			for (var i = 0; i < formatsAndCSS.length; i++) {
				ret.push(formatsAndCSS[i].style);
			}
			return ret;
		}

		/*
		  A list of formats recognized by the editor.
		*/
		var allowedCSS = _formats(formatsAndCSS);
		
		/*
		  Checks for String equality irrespective of the case.
		  I.e. eqStrings("a", "a") and eqStrings("A", "a") should be true,
		  while eqStrings("a", "b") and eqStrings("A", "b") should be false.
		*/
		function eqStrings(str_1, str_2) {
		    if (typeof str_1 === 'string'  && typeof str_2 === 'string') {
		        return str_1.toUpperCase() === str_2.toUpperCase();
			} else {
			    return false;
			}
		}
		
		/*
		  Checks whether parameters different from the default ones have been
		  attached to the main window (see richcontentparams.js for an example).
		  If this is the case, the relevant parameters will be applied in lieu of 
		  the default ones.
		*/
		function checkAndSetParams(doc) {
			var win = doc.defaultView || doc.parentWindow; 
	        var axelParamsRichContent = win ? win.axelParams ? win.axelParams['richContent'] : null : null;
			
			if (! axelParamsRichContent) {
			    return;
			}
			
		    if (axelParamsRichContent.formatsAndCSS) {
			    formatsAndCSS = axelParamsRichContent.formatsAndCSS;
				allowedCSS = _formats(formatsAndCSS);
			}
			
			if (axelParamsRichContent.dataStructure && axelParamsRichContent.dataStructure.html) {
				dataStructure.html = axelParamsRichContent.dataStructure.html; 
			}
			
			if (axelParamsRichContent.dataStructure && axelParamsRichContent.dataStructure.fragments) {
				dataStructure.fragments = axelParamsRichContent.dataStructure.fragments; 
			}
			
			if (axelParamsRichContent.dataStructure && axelParamsRichContent.dataStructure.semantic) {
				dataStructure.semantic = axelParamsRichContent.dataStructure.semantic; 
			}
		}
		
		function _checkEmptyContent(instance) {
		    if (/^\s*$/.test(innerText(instance._handle))) {
				instance._setData(instance.getDefaultData());
				instance.setListeners();
			}
		}

		/*
		  Whether some style (i.e. some string containing a sequence of CSS 
		  classes separated by spaces) is recognized by the editor. 
		  
		  The return value is a string of those classes mentioned in the parameter
		  that are allowed, separated by spaces.
        */		  
		function allowedStyle(style) {
			if (!style) {
				return null;
			}

			var splits = style.split(/\s+/);
			var ret = [];
			for (var i = 0; i < splits.length; i++) {
				if (allowedCSS.indexOf(splits[i]) !== -1) {
					ret.push(splits[i]);
				}
			}
			return ret.join(' ');
		}
		
		

		/* 
		  Returns the pop-up device asking the user whether a link 
		  just clicked should be opened or edited.
        */		  
		function _getPopupDevice (aDocument) {
			var devKey = 'popupdevice';
			var device = xtiger.session(aDocument).load(devKey);
			if (! device) {  // lazy creation
				device = new xtiger.editor.PopupDevice (aDocument); // hard-coded device for this model
				xtiger.session(aDocument).save(devKey, device);
			}
			return device;
		};

		/*
		  Returns the text content of some parent node, cleaned of any
		  HTML tag. The individual text pieces of the leaves are
		  concatenated together into a single string.
		*/
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
				return "";
			}
		}
		
		/*
		  Replaces the HTML special characters inside a string
		  with their safe equivalents.
		*/
		function escapeHTMLchars(str) {
			var cleaned = [];
			var arr = str.split("");
			for (var i = 0; i < arr.length; i++) {
				var res;
				var cur = arr[i];
				switch(cur) {
				case '&': res = '&amp;';
					break;
				case '\'': res = '&apos;';
					break;
				case '\"': res = '&quot;';
					break;
				case '>': res = '&gt;';
					break;
				case '<': res = '&lt;';
					break;
				default: res = cur;
					break;
				}
				cleaned.push(res);
			}               
			return cleaned.join('');
		}

		/*
		  Extracts the content of a tree organized along the `fragment'
		  structure and turns it into an HTML tree appropriate for the
		  editor.
		*/
		function extractFragmentContentXT(node) {

			var dataConfig = dataStructure.fragments;
			if (xtiger.ATTRIBUTE == xtdom.getNodeTypeXT(node)) {
				var dump = node.getAttribute('default');
				if (dump && (-1 === dump.search(/\S/)))  {
					return null;
				}
			}
			
			if (node.firstChild && node.firstChild.nodeType === xtdom.ELEMENT_NODE) {
				var root = document.createElement('span');
				var cur;
				while (node.firstChild) {
					cur = node.firstChild;
					if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.standard.tag)) {
						var span = document.createElement('span');
						span.innerHTML = innerText(cur);
						var styleAttribute = fragStyleToClass(cur.getAttribute(dataConfig.standard.style));
						var style = allowedStyle(styleAttribute);
						if (style) {
							xtdom.setAttribute(span, 'class', style);
						}
						node.removeChild(cur);
						root.appendChild(span);
					} else if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.link.tag)) {
						var a = document.createElement('a');
						while (cur.firstChild) {
							if (eqStrings(cur.firstChild.tagName, dataConfig.link.ref.tag)) {
								xtdom.setAttribute(a, 'href', cur.firstChild.innerHTML);
							} else if (eqStrings(cur.firstChild.tagName, dataConfig.link.text.tag)) {
								a.innerHTML = innerText(cur.firstChild);
								var styleAttribute = fragStyleToClass(cur.getAttribute(dataConfig.standard.style));
								var style = allowedStyle(styleAttribute);
								if (style) {
									xtdom.setAttribute(a, 'class', style);
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
				var singleFrag = document.createElement('span');
				singleFrag.textContent = innerText(node);
				root.appendChild(singleFrag);
			}

			return root;
		}

		/*
		  Extracts the content of a tree organized along the `HTML'
		  structure and turns it into an HTML tree regularized and
		  appropriate for the editor.
		*/
		function extractHTMLContentXT(node) {
			var dataConfig = dataStructure.html;
			if (xtiger.ATTRIBUTE == xtdom.getNodeTypeXT(node)) {
				var dump = node.getAttribute('default');
				if (dump && (-1 === dump.search(/\S/)))  {
					return null;
				}
			}

			if (node.firstChild && node.firstChild.nodeType === xtdom.ELEMENT_NODE) {
				var root = document.createElement('span');
				var cur;
				while (node.firstChild) {
					cur = node.firstChild;
					if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.standard.tag)) {
						var span = document.createElement('span');
						span.innerHTML = innerText(cur);
						var style = allowedStyle(cur.getAttribute(dataConfig.standard.style));
						if (style) {
							xtdom.setAttribute(span, 'class', style);
						}
						node.removeChild(cur);
						root.appendChild(span);
					} else if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.link.tag)) {
						var a = document.createElement('a');
						xtdom.setAttribute(a, 'href', cur.getAttribute(dataConfig.link.ref));
						a.innerHTML = innerText(cur);
						var style = allowedStyle(cur.getAttribute(dataConfig.standard.style));
						if (style) {
							xtdom.setAttribute(a, 'class', style);
						}
						node.removeChild(cur);
						root.appendChild(a);
					} else {
						node.removeChild(cur);
					}
				}
			} else {
				var root = document.createElement('span');
				var singleFrag = document.createElement('span');
				singleFrag.textContent = innerText(node);
				root.appendChild(singleFrag);
			}

			return root;
		}
		
		/*
		  Extracts the content of a tree organized along the `semantic'
		  structure and turns it into an HTML tree regularized and
		  appropriate for the editor.
		*/		
		function extractSemanticContentXT(node) {

			var dataConfig = dataStructure.semantic;
			if (xtiger.ATTRIBUTE == xtdom.getNodeTypeXT(node)) {
				var dump = node.getAttribute('default');
				if (dump && (-1 === dump.search(/\S/)))  {
					return null;
				}
			}
			
			if (node.firstChild && node.firstChild.nodeType === xtdom.ELEMENT_NODE) {
				var root = document.createElement('span');
				var cur;
				while (node.firstChild) {
					cur = node.firstChild;
					var styleAttribute = fragStyleToClass(cur.tagName);
					var style = allowedStyle(styleAttribute);
					if (cur.nodeType === xtdom.ELEMENT_NODE && (eqStrings(cur.tagName, dataConfig.standard.tag) || style)) {
						var span = document.createElement('span');
						span.innerHTML = innerText(cur);
						if (style && !eqStrings(style, dataConfig.standard.tag)) {
							xtdom.setAttribute(span, 'class', style);
						}
						node.removeChild(cur);
						root.appendChild(span);
					} else if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.link.tag)) {
						var a = document.createElement('a');
						while (cur.firstChild) {
							var styleAttribute = fragStyleToClass(cur.firstChild.tagName);
							var style = allowedStyle(styleAttribute);
							if (eqStrings(cur.firstChild.tagName, dataConfig.link.ref.tag)) {
								xtdom.setAttribute(a, 'href', cur.firstChild.innerHTML);
							} else if (eqStrings(cur.firstChild.tagName, dataConfig.link.text.standard) || style) {
								a.innerHTML = innerText(cur.firstChild);
								if (style && !eqStrings(style, dataConfig.link.text.standard)) {
									xtdom.setAttribute(a, 'class', style);
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
				var singleFrag = document.createElement('span');
				singleFrag.textContent = innerText(node);
				root.appendChild(singleFrag);
			}

			return root;
		}


        /*
		  Extracts the default content of the editor.
		  This is a hack to replace the standard default method of the same
		  name in xtdom, as the latter removes any tag.
		*/
		xtdom.extractDefaultContentXT = function (node) {
			return node;
		}

		/*
		  Turns a class attribute made of a sequence of 
		  CSS classes into a richStyle attribute with 
		  style names separated by `_'.
		*/
		function classToFragStyle(className) {
			return className.replace(/\s+/g, '_');
		}

		/*
		  Creates a log of the content of the root argument in accordance
		  with a HTML-style structure.
		*/
		function logToHTML(root, logger) { 
			var dataConfig = dataStructure.html;
			for (var i = 0; i < root.childNodes.length; i++) {
				if (eqStrings(root.childNodes[i].tagName, 'a') && root.childNodes[i].href) {
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
				} else if (eqStrings(root.childNodes[i].tagName, 'span')) {
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

		/*
		  Creates a log of the content of the root argument in accordance
		  with the `fragment' structure.
		*/
		function logToFragments(root, logger) {
			var dataConfig = dataStructure.fragments;
			for (var i = 0; i < root.childNodes.length; i++) {
				if (eqStrings(root.childNodes[i].tagName, 'a') && root.childNodes[i].href) {
					logger.openTag(dataConfig.link.tag);
					logger.openTag(dataConfig.link.text.tag);
					if (root.childNodes[i].className) {
						logger.openAttribute(dataConfig.link.text.style);
						logger.write(classToFragStyle(root.childNodes[i].className));
						logger.closeAttribute(dataConfig.link.text.style);
					}
					logger.write(root.childNodes[i].textContent);
					logger.closeTag(dataConfig.link.text.tag);
					logger.openTag(dataConfig.link.ref.tag);
					logger.write(root.childNodes[i].href);
					logger.closeTag(dataConfig.link.ref.tag);
					logger.closeTag(dataConfig.link.tag);
				} else if (eqStrings(root.childNodes[i].tagName, 'span')) {
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
		
		/*
		  Creates a log of the content of the root argument in accordance
		  with the `semantic' structure.
		*/		
		function logToSemantic(root, logger) {
			var dataConfig = dataStructure.semantic;
			for (var i = 0; i < root.childNodes.length; i++) {
				if (eqStrings(root.childNodes[i].tagName, 'a') && root.childNodes[i].href) {
					logger.openTag(dataConfig.link.tag);
					
					if (root.childNodes[i].className) {
					    var tag = classToFragStyle(root.childNodes[i].className);
					    logger.openTag(tag);
						logger.write(root.childNodes[i].textContent);
						logger.closeTag(tag);
					} else {
					    logger.openTag(dataConfig.link.text.standard);
						logger.write(root.childNodes[i].textContent);
						logger.closeTag(dataConfig.link.text.standard);
					}
					
					logger.openTag(dataConfig.link.ref.tag);
					logger.write(root.childNodes[i].href);
					logger.closeTag(dataConfig.link.ref.tag);
					
					logger.closeTag(dataConfig.link.tag);
				} else if (eqStrings(root.childNodes[i].tagName, 'span')) {
					if (root.childNodes[i].className) {
					    var tag = classToFragStyle(root.childNodes[i].className);
					    logger.openTag(tag);
						logger.write(root.childNodes[i].textContent);
						logger.closeTag(tag);
					} else {
					    logger.openTag(dataConfig.standard.tag);
						logger.write(root.childNodes[i].textContent);
						logger.closeTag(dataConfig.standard.tag);
					}
				}
			}
		}

		/*
		  Turns a rich style attribute as a list
		  of format separated by `_' into a class
		  attribute suitable for an HTML element.
		*/
		function fragStyleToClass(richStyle) {
		    if (! richStyle) {
			    return "";
			}
			return richStyle.replace(/_+/g, ' ');
		}

		/*
		  Whether a node is endowed with a class or descends from a 
		  node endowed with it.
		*/
		function inheritClass(node, className) {
			if (hasClass(node, className)) {
				return true;
			} else if (! node.parentNode) {
				return false;
			} else {
				return inheritClass(node.parentNode, className);
			}
		}

		/*
		  Whether a node has some CSS class mentioned
          among its class attribute.
        */		  
		function hasClass(node, className) {
			if (node.getAttribute) {
				return (' ' + node.getAttribute('class') + ' ' ).indexOf(' ' + className + ' ') != -1;
			} else {
				return false;
			}
		}

		/*
		  Whether all the children of some node have some class.
		*/
		function allChildrenTagged(node, className) {
			for (var i = 0; i < node.childNodes.length; i++) {
				if (! hasClass(node.childNodes[i], className) && node.childNodes[i].innerHTML !== "") {
					return false;
				}
			}
			return true;
		}

		/*
		  Adds a CSS class to the class attribute of a given node.
		*/
		function addClass(node, className) {
			if (! className) {
				return;
			}
			if (! hasClass(node, className)) {
				node.className = (node.className + ' ' + className).trim();
			}
		}

		/*
		  Removes a class name from the class attribute of some node.
		*/
		function removeClass(node, className) {
			var className = (' ' + node.className + ' ').replace(' ' + className + ' ', ' ').trim();
			node.className = className;
		}

		/*
		  Whether two nodes are endowed with the same set of
		  CSS classes, albeit in a possibly different order.
		*/
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
				if (! eqStrings(pri[i], sec[i])) {
					return false;
				}
			}
			return true;
		}

		/*
		  Whether two nodes have the same tags.
		*/
		function equalTags(primus, secundus) {
			return eqStrings(primus.tagName, secundus.tagName);
		}

		/*
		  Whether a node is a `a' element or descends from
		  such element.
		  
		  If true, returns the value of the 'href' attribute,
		  otherwise returns null;
		*/
		function inLink(node) {
			if (node.href) {
				return node.href;
			} else if (node.parentNode){
				return inLink(node.parentNode);
			} else {
				return null;
			}
		}

		/*
		  Removes all classes from a node and its descendants.
		*/
		function removeAllClasses(node) {
			if (node.nodeType === xtdom.TEXT_NODE) {
				return;
			}
			node.removeAttribute('class');
			for (var i = 0; i < node.childNodes.length; i++) {
				removeAllClasses(node.childNodes[i]);
			}
		}

		/*
		  A modal window used to display a warning to the user.
		*/
		var _modal = createModal();

		/*
		  Creates a modal window.
		*/
		function createModal() {
			// Creation of a modal to display warnings
			var div = document.createElement('div');
			xtdom.setAttribute(div, 'class', 'modal');
			div.style.display = 'none';
			return div;
		}
		
		var modalVisible = false;

		/*
		  Displays the modal over the current editable field,
		  with `text' as its content.
		  The field is made non-editable as long as the modal
		  is visible. The modal can be closed by clicking it.
		*/
		function showModal(instance, text) {
		    if (modalVisible) {
			    return;
			}
		    modalVisible = true;
		    var mainText = document.createTextNode(text);
			_modal.appendChild(mainText);
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
			
			function close() {
				    _modal.style.display='none';
					_modal.parentNode.removeChild(_modal);
					_modal.innerHTML = "";
					setEditable(instance, 'true');
					modalVisible = false;
			    }
			
			setTimeout(close, 4000);
			
			xtdom.addEventListener(_modal, 'click', close);
		}

		/*
		  The menu holding the buttons and the link-editing area.
	    */
		var _buttons = null;
		
		/*
		  Hides the menu.
		*/
		function closeButtons() {
			if (_currentInstance) {
			    var buttons = _getBUttons();
				buttons.parentNode.removeChild(buttons);
				_currentInstance.stopEditing(false);
				buttons.linkArea.value = 'http://...';
				_currentInstance.currentLink = null;
				_currentInstance._url = null;
			}
		}
		
		/*
		  Returns a reference to the menu.
		*/
		function _getBUttons() {
		    if (! _buttons) {
			    _buttons = createButtons();
			} 
			return _buttons;
		}

		/*
		  A reference to the currently editable field. 
		  We assume only one field on the page can be edited at
		  a time. Any action on the menu will be applied to
		  its elements.
		*/
		var _currentInstance = null;
		
		var menuWidth = null;

		/*
		  Sets an editable field as the current one.
		*/
		function registerEditor(instance) {
			_currentInstance = instance;
			instance.buttons = _getBUttons();
			var buttons = instance.getDocument().adoptNode(_getBUttons()); // necessary on IE
			instance.getDocument().body.style.position = 'absolute';
			instance.getDocument().body.appendChild(buttons);
			if (! menuWidth) { // The menu needs to be slightly wider than the offsetWidth to keep its shape.
			                   // But we only want to increase the width once.
			    menuWidth = buttons.linkBox.offsetWidth + 1;
			}
			xtdom.setAttribute(buttons.linkBox, 'style', 'min-width: ' + menuWidth + 'px');
		}
		
		function deregisterCurrentInstance() {
		    if (_currentInstance) {
		        _currentInstance.stopEditing(false);
		    }
			
			_currentInstance = null;
		}

		/*
		  Sets a handle as editable or not, depending on the value.
		*/
		function setEditable(instance, value) {
			xtdom.setAttribute(instance._handle, 'contenteditable', value);
		}

		/*
		  Creates the menu. 
		  
		  This is a div node, with a list of buttons matching the definitions in
		  formatsAndCSS plus a `clear' button. The menu also contains a link-edition
		  area and a `close' button to hide it.
		*/
		function createButtons() {

			var container = document.createElement('div');
			xtdom.setAttribute(container, 'class', 'buttons-container');

			var _offsetX = 0;
			var _offsetY = 0;

			xtdom.setAttribute(container, 'draggable', 'true');
			container.style.position = 'fixed';

			// Called when the menu starts being dragged
			function dragStart(ev) {
				var startRect = container.getBoundingClientRect();
				_offsetX = parseInt(ev.screenX) - startRect.left;
				_offsetY = parseInt(ev.screenY) - startRect.top;
				ev.dataTransfer.effectsAllowed = "copy";
				ev.dataTransfer.setData('text', "");
			}

			// Called at the end of the drag movement
			function dragEnd(ev) {
				var left = parseFloat(ev.screenX) - _offsetX + 'px';
				var top = parseFloat(ev.screenY) - _offsetY + 'px';
				container.style.left = left;
				container.style.top = top;
			}

			container.addEventListener('dragstart', function (ev) {dragStart(ev)}, false);
			container.addEventListener('dragend', function (ev) {dragEnd(ev)}, false);

			var buttons = document.createElement('span');

			for (var i = 0; i < formatsAndCSS.length; i++) {
				var button = document.createElement('button');
				xtdom.setAttribute(button, 'class', 'button-as-links');
				var inner = document.createElement('span');
				var style = formatsAndCSS[i].style;
				xtdom.setAttribute(inner, 'class', style);
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

			var clearButton = document.createElement('button');
			xtdom.setAttribute(clearButton, 'class', 'button-as-links');
			var inner = document.createElement('span');
			inner.textContent = 'Clear';
			clearButton.appendChild(inner);
			buttons.appendChild(clearButton);
			xtdom.addEventListener(clearButton, 'click', function() {_currentInstance.clearRange()}, false);

			var linkArea = document.createElement('textarea');
			xtdom.setAttribute(linkArea, 'class', 'url-box');
			container.linkArea = linkArea;
			
			/*
			  For some reason (probably a bug), textareas become non-editable in Firefox when
			  inside a 'draggable' element. We thus have to remove the attribute when the
			  user wants to interact with linkArea, and add it back when the mouse leaves the
			  object. Perhaps these event listeners could be removed when Firefox gets fixed...
			*/
			xtdom.addEventListener(linkArea, 'mouseover', 
			    function () {
				    container.removeAttribute('draggable');
				}, false);
			xtdom.addEventListener(linkArea, 'mouseout', 
			    function () {
				    container.setAttribute('draggable', 'true');
				}, false);

			xtdom.addEventListener(linkArea, 'change', 
			    function () {
				    _currentInstance.changeLink(linkArea, this); return false
				}, false);

			var makeLinkButton = document.createElement('span');
			var innerLinkButton = document.createElement('button');
			xtdom.setAttribute(innerLinkButton, 'class', 'button-as-links');
			innerLinkButton.textContent = 'Link';
			var innerUnlinkButton = document.createElement('button');
			xtdom.setAttribute(innerUnlinkButton, 'class', 'button-as-links');
			innerUnlinkButton.textContent = 'Unlink';
			makeLinkButton.appendChild(innerLinkButton);
			makeLinkButton.appendChild(document.createTextNode(' / '));
			makeLinkButton.appendChild(innerUnlinkButton);
			xtdom.addEventListener(innerLinkButton, 'click', 
			    function () {
			        _currentInstance.makeLink(linkArea, true); 
					return false
					}, false);
			xtdom.addEventListener(innerUnlinkButton, 'click', 
			    function () {
			        _currentInstance.makeLink(linkArea, false); return false
					}, false);
			linkOuter = document.createElement('span');
			linkArea.value = 'http://...';
			linkBox = document.createElement('div');
			linkOuter.appendChild(linkArea);
			linkBox.appendChild(linkOuter);
			linkBox.appendChild(makeLinkButton);
			buttons.appendChild(linkBox);
			container.linkBox = linkBox;

			var toggleButton = document.createElement('button');
			xtdom.setAttribute(toggleButton, 'class', 'button-as-links');
			toggleButton.textContent = 'Close';
			buttons.toggleButton = toggleButton;

			xtdom.addEventListener(toggleButton, 'click', 
			    function () {
				    closeButtons();
				}, false);

			container.appendChild(buttons);
			container.appendChild(toggleButton);

			return container;
		}

		return {

			////////////////////////
			// Life cycle methods //
			////////////////////////

			onInit : function ( aDefaultData, anOptionAttr, aRepeater ) {
			    checkAndSetParams(this.getDocument());
				if (eqStrings(this.getParam('lang'), 'html')) {
					var data = extractHTMLContentXT(aDefaultData);
				} else if (eqStrings(this.getParam('lang'), 'semantic')) {
				    var data = extractSemanticContentXT(aDefaultData);
				} else {
					var data = extractFragmentContentXT(aDefaultData);
				}
				
				if (/^\s*$/.test(innerText(data))) {
					this._content = _defaultContent; 
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
				if (this.getParam('noedit') !== 'true') {
					xtdom.addClassName(this._handle, 'axel-core-editable');
					this.setListeners();
				}
			},

			onLoad : function (aPoint, aDataSrc) {
			    /// We first have to reconstitute a tree from the aPoint array.
				if (aPoint !== -1) {
					var root = xtdom.createElement(this.getDocument(), 'span');
					for (var i = 1; i < aPoint.length; i++) { // Zero is the `parag' node. Hence we start at 1
						root.appendChild(aPoint[i]);
					}
					if (eqStrings(this.getParam('lang'), 'html')) {
						var _value = extractHTMLContentXT(root);
					} else if (eqStrings(this.getParam('lang'), 'semantic')) {
						var _value = extractSemanticContentXT(root);
					} else {
						var _value = extractFragmentContentXT(root);
					}
					var _default = this.getDefaultData();
					var defval = _value || _default;
					this._setData(defval);
					this.setModified(_value !==  _default);
					this.set(false);
					this.setListeners();
				} else {
					this.clear(false);
				}
			},

			onSave : function (aLogger) {

				if (this.isOptional() && (!this.isSet())) {
					aLogger.discardNodeIfEmpty();
					return;
				}
				if (this._handle && eqStrings(this.getParam('lang'), 'html')) {
					logToHTML(this._handle, aLogger);
				} else if (this._handle && eqStrings(this.getParam('lang'), 'semantic')) {
				    logToSemantic(this._handle, aLogger);
				} else {
					logToFragments(this._handle, aLogger);
				}
			},

			////////////////////////////////
			// Overwritten plugin methods //
			////////////////////////////////

			api : {

				isFocusable : function () {
					return ! eqStrings(this.getParam('noedit'), 'true');
				},

				focus : function () {
					this._handle.focus(); // should trigger focus event
				},

				unfocus : function () {
					this.stopEditing(false);
					closeButtons();
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
					
					var dataCopy = aData.cloneNode(true);
					
					while (dataCopy.firstChild) {
						this._handle.appendChild(dataCopy.firstChild);
					}

					this.model = aData;

				},
				
				/*
				  To be called after the editor has been cloned, to perform
				  the initialization not performed by the cloning itself
				  (most notably adding the event listeners).
				*/
			    onCloned : function (clone, original) {
					for (var i = 0; i < original.childNodes.length; i++) {
						clone.appendChild(original.childNodes[i].cloneNode(true));
				    }
				    if (this.getParam('noedit') !== 'true') {
					    this.setListeners();
				    }
					this._content = this._handle.cloneNode(true);
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

				/*
				  Sets listeners on the handle's children to wait for mouse clicks.
				*/
				setListeners : function () {
					var _this = this;
					for (var i = 0; i < this._handle.children.length; i++) {
						var child = this._handle.children[i];
						child.addEventListener('paste', function(ev) {_this.interceptPaste(ev, child); return false;}, true);
						xtdom.addEventListener(child, 'click', function(ev) {_this.clickedFrag(ev); return false;}, true);
					}
					xtdom.addEventListener(this._handle, 'blur', function() {_checkEmptyContent(_this);});
				},

				/*
				  Intercepts a paste event, and replaces it with a custom paste.
				  
				  The default behaviour is prevented to occur, the content of the
				  clipboard is extracted in text format (i.e. any HTML tag and attribute
				  is discarded), and the content is finally inserted at the cursor's 
				  position into the handle.
				*/
				interceptPaste : function (event, node) {
					//xtdom.preventDefault(event); // something seems not to work here...
					event.returnValue = false;
					if (event.stopPropagation) {event.stopPropagation();}
					if (event.preventDefault) {event.preventDefault();}

					var winText = window.clipboardData ? window.clipboardData.getData("Text") : "";
					var eventText = event.clipboardData ? event.clipboardData.getData('text') : "";
					var content = "";
					if (eventText) {
						content = eventText;
					} else if (winText) {
						content = winText;
					}

					if (content === "") {
						return false;
					}

					var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

					var newNode = xtdom.createElement(this.getDocument(), 'span');
					newNode.textContent = content;
					range.insertNode(newNode)

					var parent = newNode.parentNode;
					parent.textContent = innerText(parent);

					return false;

				},

				/*
				  Creates a simplified and regularized version of a tree with `current'
				  as its root and roots it in the `target' node.
				  
				  The editing and pasting operations tend to complicate the structure of the handle
				  by introducing empty subnodes or sequences of nodes bearing the same attributes.
				  This function will remove the first, and merge the second ones.
				  
				*/
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
						}
					}
					this.setListeners();
				},

				/*
				  Recreates a handle tree with the proper structure.
				  
				  The handle should be the parent of a list of `span' and `a' nodes,
				  each containing only a text node. The insertion of new content
				  caused by the edition disturbs that structure. This method will
				  reshape the tree, in accordance with the desired effect (adding a style,
				  creating a link, etc.).
				  
				  @param root: the root of the tree to be reshaped.
				  @param allTagged: whether all the children of the inserted node bear the `style'
				                    className.
				  @param inherit: whether the inserted node is inside a node with the
				                  required style.
				  @param style: the style to be added or removed.
				  @param link: whether the selection should be turned into a hyperlink (if true)
				               or turned back into a span (if false).
				  @param clear: whether the selection should be cleared of any style.
				*/
				recreateTree : function (root, allTagged, inherit, style, link, clear) {

					var tempRoot = xtdom.createElement(this.getDocument(), 'span');
					while (root.firstChild) {
						if (root.firstChild.firstChild) {
							while (root.firstChild.firstChild) {
								var href = inLink(root.firstChild.firstChild);
								var tag = href ? 'a' : 'span';
								if (root.firstChild.firstChild.nodeType === xtdom.TEXT_NODE) {
									var newFrag = xtdom.createElement(this.getDocument(), tag);
									if (href) {
										xtdom.setAttribute(newFrag, 'href', href);
									}
									addClass(newFrag, root.firstChild.className);
									newFrag.appendChild(root.firstChild.firstChild);
									tempRoot.appendChild(newFrag);
								} else {
				
									if (href && link) {
										var cur = xtdom.createElement(this.getDocument(), 'a');
										xtdom.setAttribute(cur, 'href', href);
									} else {
										var cur = xtdom.createElement(this.getDocument(), 'span');
									}
									cur.innerHTML = root.firstChild.firstChild.innerHTML;
									addClass(cur, root.firstChild.className);
									addClass(cur, root.firstChild.firstChild.className);
									root.firstChild.removeChild(root.firstChild.firstChild);

									if (!allTagged && !inherit) {
										addClass(cur, style);
									} else {
										removeClass(cur, style);
									}
									if (clear) {
									    removeAllClasses(cur)
									}
									tempRoot.appendChild(cur);
								}
							}
						} else {
							tempRoot.appendChild(root.firstChild);
						}
					}
					return tempRoot;
				},

                /*
				  Turns the selection into a link (if `link' is true), or suppresses
				  any link in the selection (if `link' is false).
				  
				  The value of linkArea will be used as target if it conforms to the
				  pattern of valid urls. Otherwise, a warning will pop up and the process
				  will stop (the link will not be created).
				*/
				makeLink : function (linkArea, link) {
				
					var url = linkArea.value;
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
					var content = range.extractContents();
					newNode.appendChild(content);
					range.insertNode(newNode);

					var root = this._handle;

					if (link) {
						xtdom.setAttribute(newNode, 'href', url);
					} 

					var style = "";
					var allTagged = false;
					var inherit = false;
					var clear = false;

					var tempRoot = this.recreateTree(root, allTagged, inherit, style, link, clear);

					this._handle.innerHTML = "";

					this.cleanTree(this._handle, tempRoot);
				},

				/*
				  Sets the currently selected link target to a new value.
				*/
				changeLink : function (linkArea) {
					if (this.currentLink && linkArea.value.match(urlPattern)) {
						this.currentLink.href = linkArea.value;
					}
				},

				/*
				  Clears the selected range of any style.
				*/
				clearRange : function () {

					var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

					var newNode = xtdom.createElement(this.getDocument(), 'span');
					var content = range.extractContents();
					newNode.appendChild(content);

					range.insertNode(newNode);

					var root = this._handle;

					/*if (inLink(newNode)) {
						var mainTag = 'a';
					} else {
						var mainTag = 'span';
					}*/

					var allTagged = false;
					var inherit = false;
					var style = "";
					var link = true;
					var clear = true;

					removeAllClasses(newNode);

					var tempRoot = this.recreateTree(root, allTagged, inherit, style, link, clear);

					this._handle.innerHTML = "";

					this.cleanTree(this._handle, tempRoot);
				},

				/*
				  Adds a new style to the current selection.
				*/
				enrich : function (style) {

					var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

					var newNode = xtdom.createElement(this.getDocument(), 'span');
					var content = range.extractContents();
					newNode.appendChild(content);

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

					/*if (inLink(newNode)) {
						var mainTag = 'a';
					} else {
						var mainTag = 'span';
					}*/
					
					var link = true;
                    var clear = false;

					var tempRoot = this.recreateTree(root, allTagged, inherit, style, link, clear);

					this._handle.innerHTML = "";

					this.cleanTree(this._handle, tempRoot);

				},

				/*
				  Reacts to a mouse click on the handles' children.
				*/
				clickedFrag : function (ev) {
					ev.returnValue = false;
					
					if (ev.stopPropagation) {ev.stopPropagation();}
					if (ev.preventDefault) {ev.preventDefault();}

					var target = xtdom.getEventTarget(ev);
					var tag = xtdom.getLocalName(target);
					if (eqStrings(tag, 'A')) {
						_getBUttons().linkArea.value = target;
						this.currentLink = target;
						this._url = target.href;
					} else {
						this.currentLink = null;						
					}
					if (this.editInProgress === false) {
						this.startEditing(ev);
					}
				},


				/*
				  Starts editing the field.
				*/
				startEditing : function (ev) {
					var target = xtdom.getEventTarget(ev);
					var tag = xtdom.getLocalName(target);						
					if (this.editInProgress === false) {
						if (eqStrings(tag, 'A')) { // clicked on a link
							var popupdevice = _getPopupDevice(this.getDocument());
							popupdevice.startEditing(this, ['edit', 'open'], 'edit', target);
						} else {
							this.__open__editor();
						}
					}
				},

				/*
				  Makes the editor visible.
				*/
				__open__editor : function () {
					if (this.editInProgress === false) {
						deregisterCurrentInstance();
						registerEditor(this);
						setEditable(this, 'true');
						// registers to keyboard events
						this.kbdHandlers = this.keyboard.register(this, this._handle.parentNode);
						this.keyboard.grab(this, this);
						if (eqStrings(this.getParam('multilines'), 'normal')) {
							this.keyboard.enableRC(true);
						} else {
					        this.keyboard.disableRC(false);
						}
						this.editInProgress = true;
					}
				},

				/*
				  Reacts to the choice of the user on the link-popup.
				*/
                onMenuSelection: function onMenuSelection (aSelection) {
					if (aSelection == 'edit') {
						this.__open__editor();
					} else if (aSelection == 'open') {
						// opens this.cachedURL in an external window
						window.open(this._url);
					}
				},

				/*
				  Stops the edition process.
				*/
				stopEditing : function (isCancel) {
					if ((! this.stopInProgress) && (this.editInProgress)) {
						this.stopInProgress = true;
						this.keyboard.unregister(this, this.kbdHandlers);
						this.keyboard.release(this, this);
						if (isCancel) {
							// restores previous data model
						    this._setData(this.getDefaultData());
						}
						this.stopInProgress = false;
						this.editInProgress = false;
					}

					setEditable(this, 'false')

					_checkEmptyContent(this);

				},

				/*
				  Clears the model and sets its data to the default data.
				  Unsets it if it is optional and propagates the new state if asked to.
				*/
				clear : function (doPropagate) {
					this._setData(this.getDefaultData());
					this.setModified(false);
					if (this.isOptional() && this.isSet()) {
						this.unset(doPropagate);
					}
					this.setListeners();
				},
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
