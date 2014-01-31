/*
 * Copyright 2011 eBay Software Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
var createError = require('raptor-util').createError;
var forEachEntry = require('raptor-util').forEachEntry;
var ok = require('assert').ok;

function Taglib(id) {
    ok(id, '"id" expected');
    this.id = id;
    this.dirname = null;
    this.namespace = null;
    this.aliases = [];
    this.tags = {};
    this.textTransformers = [];
    this.attributeMap = {};
    this.functions = [];
    this.helperObject = null;
    this.patternAttributes = [];
    this.importPaths = [];
}

Taglib.prototype = {
    addAttribute: function (attribute) {
        if (attribute.namespace) {
            throw createError(new Error('"namespace" is not allowed for taglib attributes'));
        }
        if (attribute.name) {
            this.attributeMap[attribute.name] = attribute;
        } else {
            this.patternAttributes.push(attribute);
        }
    },
    getAttribute: function (name) {
        var attribute = this.attributeMap[name];
        if (!attribute) {
            for (var i = 0, len = this.patternAttributes.length; i < len; i++) {
                var patternAttribute = this.patternAttributes[i];
                if (patternAttribute.pattern.test(name)) {
                    attribute = patternAttribute;
                }
            }
        }
        return attribute;
    },
    addTag: function (tag) {
        ok(arguments.length === 1, 'Invalid args');
        ok(tag.name, '"tag.name" is required');
        
        var key = (tag.namespace || '') + ':' + tag.name;
        this.tags[key] = tag;
    },
    addTextTransformer: function (transformer) {
        this.textTransformers.push(transformer);
    },
    forEachTag: function (callback, thisObj) {
        forEachEntry(this.tags, function (key, tag) {
            callback.call(thisObj, tag);
        }, this);
    },
    addFunction: function (func) {
        this.functions.push(func);
    },
    setHelperObject: function (helperObject) {
        this.helperObject = helperObject;
    },
    getHelperObject: function () {
        return this.helperObject;
    },
    addAlias: function (alias) {
        this.aliases.push(alias);
    }
};
Taglib.Tag = function () {
    function Tag(taglib) {
        ok(taglib, '"taglib" expected');
        this.taglib = taglib;
        // this.handlerClass = null;
        // this.nodeClass = null;
        // this.renderer = null;
        // this.template = null;
        this.attributeMap = {};
        this.transformers = {};
        this.nestedVariables = {};
        this.importedVariables = {};
        this.nestedTags = {};
        this.staticProperties = {};
        this.patternAttributes = [];
        
    }
    Tag.prototype = {
        inheritFrom: function (superTag) {
            var subTag = this;
            /*
             * Have the sub tag inherit any properties from the super tag that are not in the sub tag
             */
            forEachEntry(superTag, function (k, v) {
                if (subTag[k] === undefined) {
                    subTag[k] = v;
                }
            });
            function inheritProps(sub, sup) {
                forEachEntry(sup, function (k, v) {
                    if (!sub[k]) {
                        sub[k] = v;
                    }
                });
            }
            [
                'attributeMap',
                'transformers',
                'nestedVariables',
                'importedVariables',
                'nestedTags',
                'staticProperties'
            ].forEach(function (propName) {
                inheritProps(subTag[propName], superTag[propName]);
            });
            subTag.patternAttributes = superTag.patternAttributes.concat(subTag.patternAttributes);
        },
        addNestedTag: function (nestedTag) {
            var namespace = nestedTag.namespace || '';
            this.nestedTags[namespace + ':' + nestedTag.name] = nestedTag;
        },
        forEachNestedTag: function (callback, thisObj) {
            forEachEntry(this.nestedTags, function (key, nestedTag) {
                callback.call(thisObj, nestedTag);
            });
        },
        forEachVariable: function (callback, thisObj) {
            forEachEntry(this.nestedVariables, function (key, variable) {
                callback.call(thisObj, variable);
            });
        },
        forEachImportedVariable: function (callback, thisObj) {
            forEachEntry(this.importedVariables, function (key, importedVariable) {
                callback.call(thisObj, importedVariable);
            });
        },
        forEachTransformer: function (callback, thisObj) {
            forEachEntry(this.transformers, function (key, transformer) {
                callback.call(thisObj, transformer);
            });
        },
        forEachStaticProperty: function (callback, thisObj) {
            forEachEntry(this.staticProperties, function (key, staticProp) {
                callback.call(thisObj, staticProp);
            });
        },
        hasTransformers: function () {
            /*jshint unused:false */
            for (var k in this.transformers) {
                return true;
            }
            return false;
        },
        addAttribute: function (attr) {
            if (attr.pattern) {
                this.patternAttributes.push(attr);
            } else {
                var namespace = attr.namespace;
                if (namespace == null) {
                    namespace = this.taglib.id;
                }

                this.attributeMap[namespace + ':' + attr.name] = attr;
            }
        },
        getAttribute: function (localName) {
            
            var attr = this.attributeMap[this.taglib.id + ':' + localName] || this.attributeMap[this.taglib.id + ':*'] || this.attributeMap['*:' + localName] || this.attributeMap['*:*'];
            if (!attr && this.patternAttributes.length) {
                for (var i = 0, len = this.patternAttributes.length; i < len; i++) {
                    var patternAttribute = this.patternAttributes[i];
                    
                    if (patternAttribute.pattern.test(localName)) {
                        attr = patternAttribute;
                        break;
                    }
                }
            }
            return attr;
        },
        toString: function () {
            return '[Tag: <' + this.namespace + ':' + this.name + '>]';
        },
        forEachAttribute: function (callback, thisObj) {
            forEachEntry(this.attributeMap, function (attrName, attr) {
                callback.call(thisObj, attr);
            });
        },
        addNestedVariable: function (nestedVariable) {
            var key = nestedVariable.nameFromAttribute ? 'attr:' + nestedVariable.nameFromAttribute : nestedVariable.name;
            this.nestedVariables[key] = nestedVariable;
        },
        addImportedVariable: function (importedVariable) {
            var key = importedVariable.targetProperty;
            this.importedVariables[key] = importedVariable;
        },
        addTransformer: function (transformer) {
            var key = transformer.path;
            transformer.taglib = this.taglib;
            this.transformers[key] = transformer;
        },
        addStaticProperty: function (prop) {
            var key = prop.name;
            this.staticProperties[key] = prop;
        }
    };
    return Tag;
}();
Taglib.Attribute = function () {
    function Attribute(namespace, name) {
        this.namespace = namespace;
        this.name = name;
        this.type = null;
        this.required = false;
        this.type = 'string';
        this.allowExpressions = true;
    }
    Attribute.prototype = {};
    return Attribute;
}();
Taglib.Property = function () {
    function Property() {
        this.name = null;
        this.type = 'string';
        this.value = undefined;
    }
    Property.prototype = {};
    return Property;
}();
Taglib.NestedVariable = function () {
    function NestedVariable() {
        this.name = null;
    }
    NestedVariable.prototype = {};
    return NestedVariable;
}();
Taglib.ImportedVariable = function () {
    function ImportedVariable() {
        this.targetProperty = null;
        this.expression = null;
    }
    ImportedVariable.prototype = {};
    return ImportedVariable;
}();
Taglib.Transformer = function () {
    var uniqueId = 0;
    function Transformer() {
        this.id = uniqueId++;
        this.name = null;
        this.tag = null;
        this.path = null;
        this.after = null;
        this.before = null;
        this.instance = null;
        this.properties = {};
    }
    Transformer.prototype = {
        getInstance: function () {
            if (!this.filename) {
                throw createError(new Error('Transformer class not defined for tag transformer (tag=' + this.tag + ')'));
            }
            if (!this.instance) {
                var Clazz = require(this.filename);
                if (Clazz.process) {
                    return Clazz;
                }
                this.instance = new Clazz();
                this.instance.id = this.id;
            }
            return this.instance;
        },
        toString: function () {
            return '[Taglib.Transformer: ' + this.filename + ']';
        }
    };
    return Transformer;
}();
Taglib.Function = function () {
    function Func() {
        this.name = null;
        this.path = null;
        this.bindToContext = false;
    }
    Func.prototype = {};
    return Func;
}();
Taglib.HelperObject = function () {
    function HelperObject() {
        this.path = null;
    }
    HelperObject.prototype = {};
    return HelperObject;
}();
module.exports = Taglib;