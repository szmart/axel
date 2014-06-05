

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
 * Author(s) : Stéphane Martin
 * 
 * ***** END LICENSE BLOCK ***** */
 

    /*
	  A link to this file should be included on the XHTML template to load the parameters.
	*/
 
    if (! window.axelParams) {
        window.axelParams = {};
    }
  
    window.axelParams['richContent'] = {
        formatsAndCSS : [
			{name : 'Bold', style : 'bold'},
			{name : 'Italics', style : 'italics'},
			{name : 'Underline', style : 'underline'},
			{name : 'Strike', style : 'line-through'}
		],
		
		dataStructure : {
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
    }