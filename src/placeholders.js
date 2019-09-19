const get = require('get-value')
const Traverse = require('traverse')
const Jsonic = require('jsonic')

const defaultOptions = {
  trusted: false,
  replacer: value => String(value)
}
const buildOptions = options => Object.assign({}, defaultOptions, options)

const defaultSeparator = ':'
const metadataSeparator = '|'
const prefix = '?'

const hasRegex = /\{\s*\?\s*[^\s:|][^}]*\}/
const placeholderRegex = /\{\s*\?\s*[^\s:|][^}]*\}/g
const rootRegex = /^\.?\/(.+)$/

/** @typedef {(value: any, expression: string, metadata?: object) => any} Replacer */

/**
 * Takes an object or a string and resolve all placeholders in it or in its properties recursively.
 * Rules:
 *  - Strings looks like "Hello, {? person/name}"
 *  - Placeholders like {? person/name} are resolved evaluating model.person.name
 *  - Placeholders like {? .} are resolved with the model itself
 *  - Placeholders like {? $PATH} are resolved with process.env.PATH (only when option trusted: true is provided)
 *
 * Using replacer function:
 *
 *   resolve('Hello, {? name}!', {name: 'Juanito'}, (value, expression, metadata) => value.toUpperCase())
 *   // -> 'Hello, JUANITO!'
 *
 * Using metadata: placeholder can have attributes
 *
 *   resolve('Hello, {? name | tagName: span }!',
 *      {name: 'Juanito'},
 *      (value, expression, data) => '<' + data.tagName + '>' + value + '</' + data.tagName + '>')
 *   // -> 'Hello, <span>Juanito</span>!'
 *
 * @param {any} template Source string or object containing placeholders to resolve
 * @param {any} [model] Object used to extract data from
 * @param {object} [options] {trusted: false} if true environment variables are not resolved
 * @param {Replacer} [options.replacer] Optional function(value, expression, metadata) called to perform replacements
 * @param {object} [options.trusted] if true, environment variables are resolved. Default: false
 * @returns {string} A string or compatible object with all the placeholders resolved
 */
function resolve(template, model, options) {
  options = buildOptions(options)
  if (typeof(template) === 'string') return resolveString(template, model, options)
  if (template && typeof(template) === 'object') return resolveObject(template, model, options)
  return template
}

/**
 * Determines if a string or object has unresolved placeholders
 * @param {any} template
 * @returns {boolean}
 */
function has(template) {
  if (typeof(template) === 'string') return stringHas(template)
  if (template && typeof(template) === 'object') return objectHas(template)
  return false
}

function placeholders(template) {
  if (typeof(template) === 'string') return placeholdersOfString(template)
  if (template && typeof(template) === 'object') return placeholdersOfObject(template)
  return []
}

/**
 * Build a template
 * @param {any} template
 * @returns {(arg?: any) => any}
 */
function Template(any, options) {
  const hasPlaceholders = has(any)
  const template = hasPlaceholders ? args => resolve(any, args, options) : () => any
  template.hasPlaceholders = () => hasPlaceholders
  template.placeholders = () => placeholders(any)
  return template
}

/*
Private
*/

function resolveObject(object, model, options) {
	return Traverse(object)
		.map(value => 'string' === typeof(value) ? resolveString(value, model, options) : value)
}

function stringHas(string) {
  return hasRegex.test(string)
}

function objectHas(object) {
  return Traverse(object).nodes().some(n => typeof(n) === 'string' && stringHas(n))
}

function parseValue(text) {
  if (!isNaN(text)) return Number.parseFloat(text)
  if (text === 'true') return true
  if (text === 'false') return false
  return text
}

function splitPlaceholder(text) {
  let metadata = undefined
  let defaultValue = undefined

  const questionPos = text.indexOf('?')
  text = text.substring(questionPos + 1, text.length - 1)

  const metadataPos  = text.indexOf(metadataSeparator) + 1
  if (metadataPos > 0) {
    metadata = text.substr(metadataPos).trim() || undefined
    text = text.substring(0, metadataPos - 1)
  }

  const defaultPos = text.indexOf(defaultSeparator) + 1
  if (defaultPos > 0) {
    defaultValue = text.substr(defaultPos).trim() || undefined
    text = text.substring(0, defaultPos - 1)
  }
  const expression = text.trim() || undefined

  return {
    expression,
    defaultValue,
    metadata
  }
}

/**
 * @param {string} text
 */
function parsePlaceholder(text) {
  const parts = splitPlaceholder(text)

  return {
    expression: parts.expression,
    defaultValue: parseValue(parts.defaultValue),
    metadata: parts.metadata && Jsonic(parts.metadata)
  }
}

function resolvePlaceholder(placeholder, model, options) {
  const parts = parsePlaceholder(placeholder)
  let value = resolveExpression(parts.expression, model, options)
  if (value === undefined || value === null) {
    value = parts.defaultValue || value
  }
  return options.replacer(value, parts.expression, parts.metadata)
}

function resolveString(string, model, options) {
  return string.replace(placeholderRegex, function(placeholder) {
    return resolvePlaceholder(placeholder, model, options)
	})
}

function placeholdersOfString(string) {
  const phs = string.match(placeholderRegex) || []
  return phs.map(placeholder => parsePlaceholder(placeholder))
}

function placeholdersOfObject(object) {
  return Traverse(object).nodes().filter(n => typeof(n) === 'string').flatMap(s => placeholdersOfString(s))
}

/**
 * @param {string} expression
 * @param {any} model
 * @param {object} options
 */
function resolveExpression(expression, model, options) {
	if(expression.startsWith('$')) {
    const variable = expression.substr(1)
		if (options.trusted) {
			return process.env[variable]
		}
	}
	if (expression == '.' || expression == './' || expression == '/') return model
	match = expression.match(rootRegex)
	if (match) expression = match[1]
	return get(model, expression, { separator: '/' })
}

module.exports = { resolve, has, placeholders, Template }