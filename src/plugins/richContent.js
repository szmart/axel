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

   // Mention the issue with the listeners

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
		var span = xtdom.createElement(aDocument, 'span');
		aContainer.appendChild(handle);
		return handle;
	};

	// Uses a closure to store class level private utility properties and functions
	var _Editor = (function () {
        
		/*
		  The regex pattern used to define a valid URL.
		*/
		var urlPattern = new RegExp(/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,}\.[a-z]{2,}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi);

		//var _timestamp = -1;

		/*function _focusAndSelect ( editor ) {
	// pre-condition: the editor's handle must already have focus
	try {
		editor.getDocument().execCommand('selectAll', false, ''); // FIXME: fails on iPad
	}
	catch (e) { }
	}*/

		/* 
		  The format names as displayed on the buttons and their corresponding CSS span.class
		*/
		var formatsAndCSS = [
			{name : 'Bold', style : 'bold'},
			{name : 'Italics', style : 'italics'},
			{name : 'Underline', style : 'underline'},
			{name : 'Strike', style : 'line-through'}
		];
		
        /*
		  The default structure of the data to be loaded and saved. Two main structures should 
		  be defined. In the html-like structure, links are represented as nodes (by default with a
		  `a' tag) parents to some text content and bearing a target attribute (by default, a
		  `href'). In the `fragment' case, links are parents to two nodes: a `text'-tagged
		  node containing some text child, and a `ref' child containing the target url. In both
		  cases, the text can be qualified by a style attribute.
		  
		  The `semantic' structure is to be defined by the user with its own categories. The node 
		  tags themselves will serve as formats (provided they are among the allowed CSS recognized
		  by the editor). 
		  
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
			var ret = []
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
		  Check for String equality irrespective of their case.
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
		  If this is the case the relevant parameters will be applied in lieu of 
		  the default ones.
		*/
		function checkAndSetParams(doc) {
			var win = doc.defaultView || doc.parentWindow; 
	        var axelParamsRichContent = win ? win.axelParams ? win.axelParams['richContent'] : null : null;
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

		/*
		  Whether some style (i.e. some string containing a sequence of CSS 
		  classes separated by spaces) is recognized by the
          editor. 
		  
		  The return value is a string of allowed CSS classes separated by spaces.
        */		  
		function allowedStyle(style) {
			if (!style) {
				return null;
			}

			var splits = style.split(/ /); // we should allow for several spaces !!!!
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
		  Returns the text content of some parent node, rid of any
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
				return ""
			}
		}
		
		/*
		  Replaces the HTML special characters inside a string
		  with their safe equivalents.
		*/
		function escapeHTMLchars(str) {
		    return str;
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
				cleaned.push(res)
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
			

			if (node.childNodes) {
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
							span.setAttribute('class', style);
						}
						node.removeChild(cur);
						root.appendChild(span);
					} else if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.link.tag)) {
						var a = document.createElement('a');
						while (cur.firstChild) {
							if (eqStrings(cur.firstChild.tagName, dataConfig.link.ref.tag)) {
								a.setAttribute('href', cur.firstChild.innerHTML);
							} else if (eqStrings(cur.firstChild.tagName, dataConfig.link.text.tag)) {
								a.innerHTML = cur.firstChild.innerHTML;
								var styleAttribute = fragStyleToClass((cur.getAttribute(dataConfig.standard.style)));
								var style = allowedStyle(styleAttribute);
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

			if (node.childNodes) {
				var root = document.createElement('span');
				var cur;
				while (node.firstChild) {
					cur = node.firstChild;
					if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.standard.tag)) {
						var span = document.createElement('span');
						span.innerHTML = innerText(cur);
						var style = allowedStyle(cur.getAttribute(dataConfig.standard.style));
						if (style) {
							span.setAttribute('class', style);
						}
						node.removeChild(cur);
						root.appendChild(span);
					} else  if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.link.tag)) {
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
			
			//alert(node)

			if (node.childNodes) {
				var root = document.createElement('span');
				var cur;
				while (node.firstChild) {
					cur = node.firstChild;
					var style = allowedStyle(cur.tagName);
					if (cur.nodeType === xtdom.ELEMENT_NODE && (eqStrings(cur.tagName, dataConfig.standard.tag) || style)) {
						var span = document.createElement('span');
						span.innerHTML = innerText(cur);
						var styleAttribute = fragStyleToClass(cur.tagName);
						var style = allowedStyle(styleAttribute);
						if (! eqStrings(style, dataConfig.standard.tag)) {
							span.setAttribute('class', style);
						}
						node.removeChild(cur);
						root.appendChild(span);
					} else if (cur.nodeType === xtdom.ELEMENT_NODE && eqStrings(cur.tagName, dataConfig.link.tag)) {
						var a = document.createElement('a');
						while (cur.firstChild) {
						    //alert(cur.firstChild.tagName + " " + dataConfig.link.text.tag)
							if (eqStrings(cur.firstChild.tagName, dataConfig.link.ref.tag)) {
								a.setAttribute('href', cur.firstChild.innerHTML);
							} else if (eqStrings(cur.firstChild.tagName, dataConfig.link.text.standard) || 
							             allowedStyle(cur.firstChild.tagName)) {
								a.innerHTML = cur.firstChild.innerHTML;
								var styleAttribute = fragStyleToClass(cur.firstChild.tagName);
								var style = allowedStyle(styleAttribute);
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
		  Extracts the default content of the editor.
		  This is a hack to replace the standard default method of the same
		  name in xtdom, as it removes any tag.
		*/
		xtdom.extractDefaultContentXT = function (node) {
			return node;
		}

        /*
		  Regularizes the content
		*/
		// Test whether this is useful
		function normalize(content, doc) {
			// TODO should normalize ill-formed data as much as possible

			if (typeof content === typeof 'abc') {
				var span = xtdom.createElement(doc, 'span');
				span.innerHTML = content;
				return span;
			}
			return content;
		}

		/*
		  Turns a class attribute made of a sequence of 
		  CSS classes into a richStyle attribute with 
		  style names separated by `_'.
		*/
		function classToFragStyle(className) {
			return className.replace(/\s+/g, '_');
		}
		
		// Check that the span and fragments style use the correct style attributes...

		/*
		  Creates a lof of the content of the root argument in accordance
		  with a HTML-style structure.
		*/
		function logToHTML(root, logger) { // keep that name ???
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
		  Whether a node bears a class or descends from a 
		  node bearing this class.
		*/
		function inheritClass(node, className) {
			if (hasClass(node, className)) {
				return true;
			} else if (! node.parentNode) {
				return false
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
		  Whether all the children of some node bear some
		  class.
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
		  Adds a CSS class to the class attribute some node.
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
		  Removes all classes from a node
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
			div.setAttribute('class', 'modal');
			div.style.display = 'none';
			return div;
		}

		/*
		  Displays the modal over the current editable field.
		  The field is made non-editable as long as the modal
		  is visible. The modal can be closed by clicking it.
		*/
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

		/*
		  The menu holding the buttons and the link editing area
	    */
		var _buttons = null; // keep that name ??
		
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
		  a time. Any action on the field will be applied to
		  its elements.
		*/
		var _currentInstance = null;

		/*
		  Sets an editable field as the current one.
		*/
		function registerEditor(instance) {
			_currentInstance = instance;
			//_buttons.linkArea.value = 'http://...';
			instance.buttons = _getBUttons();
			var buttons = instance.getDocument().adoptNode(_getBUttons()); // necessary on IE
			instance._handle.parentNode.appendChild(buttons);
		}

		/*
		  Sets a handle as editable or not, depending on the value.
		*/
		function setEditable(instance, value) {
			xtdom.setAttribute(instance._handle, 'contenteditable', value);
			// For some reason, the paste works only occasionally when the parent node is not
			// set to be content editable.
			xtdom.setAttribute(instance._handle.parentNode, 'contenteditable', value);
		}

		/*
		  Creates the menu. 
		  
		  This is a div node, with a list of buttons matching the definitions in
		  formatsAndCSS plus a `clear' button. The menu also contains a link edition
		  area and a `close' button to hide it.
		*/
		function createButtons() {

			var container = document.createElement('div');//xtdom.createElement(instance.getDocument(), 'span');
			container.setAttribute('class', 'buttons-container');
			container.setAttribute('contenteditable', 'false');

			var _offsetX = 0;
			var _offsetY = 0;

			container.setAttribute('draggable', 'true');

			/* Called when the menu starts being dragged*/
			function dragStart(ev) {
				var startRect = container.getBoundingClientRect();
				_offsetX = parseInt(ev.screenX) - startRect.left;
				_offsetY = parseInt(ev.screenY) - startRect.top;
				//console.log(_offsetX + " " + _offsetY + " " + parseInt(ev.clientX) + " " + parseInt(ev.clientY))
				ev.dataTransfer.effectsAllowed = "copy";
				ev.dataTransfer.setData('text', "");
				console.log('start')
				//console.log(document.outerHTML);
			}

			/* Called at the end of the drag movement*/
			function dragEnd(ev) {
				//console.log('stop')
				//container.innerHTML = "<span>drop</span>"
				//ev.stopPropagation();
				var left = (parseInt(ev.screenX) - _offsetX) + 'px';
				var top = (parseInt(ev.screenY) - _offsetY) + 'px';
				//console.log(_offsetX + " " + _offsetY + " " + ev.screenX + " " + ev.screenY)
				container.style.left = left;
				container.style.top = top;
			}

			container.addEventListener('dragstart', function (ev) {dragStart(ev)}, false);
			container.addEventListener('dragend', function (ev) {dragEnd(ev)}, false);

			var buttons = document.createElement('span');//xtdom.createElement(instance.getDocument(), 'span');


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

			xtdom.addEventListener(linkArea, 'change', 
			    function () {
				    _currentInstance.changeLink(linkArea, this); return false
				}, false);

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
			linkBox = document.createElement('div'); // xtdom.createElement(instance.getDocument(), 'div');
			linkOuter.appendChild(linkArea);
			linkBox.appendChild(linkOuter);
			linkBox.appendChild(makeLinkButton);
			buttons.appendChild(linkBox);

			var toggleButton = document.createElement('button'); //xtdom.createElement(instance.getDocument(), 'span');
			toggleButton.setAttribute('class', 'button-as-links');
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
					//xtdom.addEventListener(this._handle, 'mousedown', function(ev) { if (ev.shiftKey) { _timestamp = new Date().getTime(); } }, true);
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

					while (this._handle.firstChild) { //is there a remove-all-children function ??
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
						//child.addEventListener('click', function(ev) {  _this.clickedFrag(ev); return false;}, true);
						child.addEventListener('paste', function(ev) {_this.interceptPaste(ev, child); return false;}, true);
						//child.addEventListener('beforepaste', function(ev) {ev.returnValue = false; return false;}, true);
						xtdom.addEventListener(child, 'click', function(ev) {  _this.clickedFrag(ev); return false;}, true);
						//xtdom.addEventListener(child, 'paste', function(ev) {  _this.interceptPaste(ev, child);}, true);
					}
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
					event.stopPropagation();
					event.preventDefault();

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

					//content = escapeHTMLchars(content);
					//alert(content)

					var range = xtdom.getWindow(this.getDocument()).getSelection().getRangeAt(0);

					var newNode = xtdom.createElement(this.getDocument(), 'span');
					//var text = xtdom.createTextNode(this.getDocument(), content);
					newNode.textContent = content;
					//mus in 260  </fragment>,
					range.insertNode(newNode) // could we just insert text here without creating a node ????

					var parent = newNode.parentNode;
					parent.textContent = innerText(parent);

					return false;

				},

				/*
				  Creates a simplified and regularized version of a tree with current
				  as its root and roots it in the target node.
				  
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
				*/
				recreateTree : function (root, mainTag, allTagged, inherit, style, link, clear) {

					var tempRoot = xtdom.createElement(this.getDocument(), 'span');
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
									if (eqStrings(mainTag, 'a') || (href && link)) {
										var cur = xtdom.createElement(this.getDocument(), 'a'); // xtdom...
										cur.setAttribute('href', href);
									} else {
										var cur = xtdom.createElement(this.getDocument(), 'span'); // xtdom...
									}
									cur.innerHTML = root.firstChild.firstChild.innerHTML;
									addClass(cur, root.firstChild.className);
									addClass(cur, root.firstChild.firstChild.className);
									root.firstChild.removeChild(root.firstChild.firstChild);

									if (!allTagged && !inherit) {
										addClass(cur, style);
									} else {
										removeClass(cur, style); // is this ever used ??
										//cur.className = undefined;
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
				
				    // We should check whether the user is trying to unlink a non-link or vice-versa
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
					var content = range.extractContents()
					newNode.appendChild(content)
					range.insertNode(newNode)

					var root = this._handle;

					if (link) {
						var mainTag = 'a';
						newNode.setAttribute('href', url);
					}

					var style = "";
					var allTagged = false;
					var inherit = false;
					var clear = false;

					var tempRoot = this.recreateTree(root, mainTag, allTagged, inherit, style, link, clear);

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
				  Clears the selected range from any style.
				*/
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
					var link = true;
					var clear = true;

					removeAllClasses(newNode);

					var tempRoot = this.recreateTree(root, mainTag, allTagged, inherit, style, link, clear);

					this._handle.innerHTML = "";

					this.cleanTree(this._handle, tempRoot);
				},

				/*
				  Adds a new style to the current selection.
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

					if (inLink(newNode)) {
						var mainTag = 'a';
					} else {
						var mainTag = 'span';
					}
					
					var link = true;
                    var clear = false;

					var tempRoot = this.recreateTree(root, mainTag, allTagged, inherit, style, link, clear);

					this._handle.innerHTML = "";

					this.cleanTree(this._handle, tempRoot);

				},

				
				clickedFrag : function (ev) {
					ev.returnValue = false;
					ev.stopPropagation();
					ev.preventDefault();

					var target = xtdom.getEventTarget(ev);
					var tag = xtdom.getLocalName(target);
					if (eqStrings(tag, 'A')) {
						_getBUttons().linkArea.value = target;
						this.currentLink = target;
						this._url = target.href;
					} else {
						//_buttons.linkArea.value = 'http://...';
						this.currentLink = null;						
					}
					if (this.editInProgress === false) {
						this.startEditing(ev);
					}
				},


				// Starts editing the field (to be called once detected)
				startEditing : function (ev) {
					var target = xtdom.getEventTarget(ev);
					var tag = xtdom.getLocalName(target);					
					if (ev && this.editInProgress == false) {
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
						this.editInProgress = true;
						setEditable(this, 'true');
						registerEditor(this);
						// registers to keyboard events
						this.kbdHandlers = this.keyboard.register(this, this._handle.parentNode);
						this.keyboard.grab(this, this);
						if (eqStrings(this.getParam('multilines'), 'normal')) {
							this.keyboard.enableRC(true);
						} else {
					        this.keyboard.disableRC(false);
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

				// Stops the edition process on the device
				stopEditing : function (isCancel) {
					if ((! this.stopInProgress) && (this.editInProgress !== false)) {
						this.stopInProgress = true;
						this.keyboard.unregister(this, this.kbdHandlers);
						this.keyboard.release(this, this);
						xtdom.removeEventListener(this._handle, 'blur', this.blurHandler, false);
						if (isCancel) {
							// restores previous data model
						    this._setData(this.getDefaultData());
						}
						//this._handle.blur();
						//        xtdom.addClassName(this._handle, 'axel-core-editable');
						this.stopInProgress = false;
						this.editInProgress = false;

					}

					setEditable(this, 'false')

					if (/^\s*$/.test(innerText(this._handle))) {
						this._setData(this.getDefaultData());
						this.setListeners();
					}

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
					this.stopEditing(false);
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
