/* This webpack loader is modified from 'js-to-styles-var-loader'.
https://github.com/tompascall/js-to-styles-var-loader (ISC license)

* Originally it suppose can load js exported modules to 'less' and 'sass/scss' via require statement,
* but it thought itself was very clever,
* and only to determine which processor to use based on testing the file type.
* This makes it breaks down when it encounters the extracted scss from vue files,
* as the file name is not ended with 'scss'.
*
* Some changes:
* Improved RegEx for require statement identification.
* Use webpack this.resolve to resolve path instead of blindly path.join,
* which is asynchronous.
* Use stringReplaceAsync instead of String.prototype.replace.
* As of this, mergeVarsToContent returns a Promise and
* the whole loader is async now.
*/

const path = require('path');
const decache = require('decache');
const squba = require('squba');
const loaderUtils = require('loader-utils');
const stringReplaceAsync = require('string-replace-async');

// Updated by huashengwang1989
const requireReg = /require\s*\((["'])([@\/]?[\w.\-\/]+)(?:\1)\)((?:\.[\w_-]+)*);?/igm;

const operator = {

    validateExportType (data, relativePath) {
        if (Object.prototype.toString.call(data) !== '[object Object]') {
            throw new Error(`Export must be an object '${relativePath}'`);
        }
    },

    // Ensure it is a flat object with finite number/string values.
    validateVariablesValue(value, property, relativePath) {
        if (Object.prototype.toString.call(value) !== '[object Object]') {
            throw new Error(`Only an object can be converted to style vars (${relativePath}${property})`);
        }

        const keys = Object.keys(value);
        for (const k of keys){
            if (!(
                // Define ok types of value (can be output as a style var)
                typeof value[k] === "string"
                || (typeof value[k] === "number" && Number.isFinite(value[k]))
            )) {
                throw new Error(
                    `Style vars must have a value of type "string" or "number". Only flat objects are supported. ` +
                    `In: ${relativePath}${property ? ":" : ""}${property}`);
            }
        }

        return true;
    },

    getVarData(relativePath, property) {
        decache(relativePath);
        const data = require(relativePath);
        if (!data) {
            throw new Error(`No data in '${relativePath}'.`);
        }
        this.validateExportType(data, relativePath);
        if (property) {
            const propVal = squba(data, property);
            this.validateExportType(propVal, relativePath);
            this.validateVariablesValue(propVal, property, relativePath);
            return propVal;
        }
        return data;
    },

    transformToSassVars(varData) {
        const keys = Object.keys(varData);
        return keys.reduce( (result, key) => {
            result += `$${key}: ${varData[key]};\n`;
            return result;
        }, '');
    },

    transformToLessVars (varData) {
        const keys = Object.keys(varData);
        return keys.reduce( (result, key) => {
            result += `@${key}: ${varData[key]};\n`;
            return result;
        }, '');
    },

    transformToStyleVars ({ type, varData } = {}) {
        switch(type){
            case 'sass':
                return this.transformToSassVars(varData);
            case 'less':
                return this.transformToLessVars(varData);
            default:
                throw new Error(`Unknown preprocessor type: ${type}`);

        }
    },

    propDeDot (strPropMatch) {
        if (!strPropMatch || strPropMatch[0] !== ".")
            return strPropMatch;
        else
            return strPropMatch.substr(1);
    },
    
    // Updated by huashengwang1989
    /*
    * @param { String } preprocessorType - 'sass' || 'less'
    * @return { Promise }
    */
    mergeVarsToContent (content, webpackContext, preprocessorType){
        const replacer = function(match_require_string, quote, relativePath){
            /* 
            * I don't know what 'property' is for... 
            * Previously as an argument after 'relativePath'.
            * Having a property will result in 'validateExportType' check for that.
            * hence I just set it as an empty String. - huashengwang1989
            */
            const property = "";
            return new Promise((resolve,reject) => {
                function handlePathResolve(err, modulePath){
                    if (!!err){
                        // If only the file name, webpackContext.resolve would throw an error.
                        // in this case, just join the path.
                        modulePath = path.join(webpackContext.context, relativePath);
                    }
                    const varData = this.getVarData(modulePath, this.propDeDot(property));
                    webpackContext.addDependency(modulePath);
                    const style_vars = this.transformToStyleVars({
                        type: preprocessorType,
                        varData
                    });
                    resolve(style_vars)
                }
                webpackContext.resolve(webpackContext.context, relativePath, handlePathResolve.bind(this))
            })
        };
        return stringReplaceAsync(content, requireReg, replacer.bind(this))
    },

    getResource (context) {
        return context._module.resource;
    },

    // Updated by huashengwang1989
    /* Add a @param "enforceType" to tell it which process to use,
    * instead of letting it to guess based on file extensions,
    * as this may not hold for extracted CSS.
    * @param { String } enforceType - accepts 'less','scss','sass'
    */
    getPreprocessorType ( { resource, enforceType } ={}) {
        if (['sass','scss','less'].includes(enforceType)){
            return enforceType === 'less' ? 'less' : 'sass';
        }
        const preProcs = [
            {
                type: 'sass',
                reg: /\.scss$|\.sass$/
            },
            {
                type: 'less',
                reg: /\.less$/
            }
        ];

        const result = preProcs.find( item => item.reg.test(resource));
        if (result) return result.type;
        throw Error(`Unknown preprocesor type for ${resource}`);
    }
};

exports.operator = operator;

// updated by huashengwang1989
const loader = function (content) {
    const webpackContext = this;
    const resource = operator.getResource(webpackContext);
    const options = loaderUtils.getOptions(webpackContext);
    const enforce_preprocessor_type = !!options && !!options.useProcessor ? options.useProcessor : null;
    const preprocessorType = operator.getPreprocessorType({ resource, 'enforceType': enforce_preprocessor_type });
    var callback = webpackContext.async();
    operator.mergeVarsToContent(content, webpackContext, preprocessorType)
    .then(res => {
        callback(null, res);
    })
    .catch(err => {
        callback(err);
    })
};

exports.default = loader;
