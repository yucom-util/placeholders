const Assert = require('assert');
const { expect } = require('chai')
const { resolve, has, placeholders, Template } = require('../src/placeholders')

describe('String utilities test', function() {
  describe('has', function() {

    it('No placeholders', () => {
      Assert.ok(!has('No placeholders here'))
      Assert.ok(!has('No placeholders here also {? }'))
      Assert.ok(!has('No placeholders here also {? : | }'))
      Assert.ok(!has('No placeholders here also {? | }'))
      Assert.ok(!has({ a: '', b: 44, c: true, d: [] }))
      Assert.ok(!has(null))
      Assert.ok(!has(true))
      Assert.ok(!has(['{?:543}']))
      Assert.ok(!has(77))
    })

    it('Simple placeholders', () => {
      Assert.ok(has('Placeholder {? h }!'))
      Assert.ok(has('Placeholder {   ?here}!'))
      Assert.ok(has('Placeholder {? ./here }!'))
      Assert.ok(has('Placeholder {?/here }!'))
      Assert.ok(has('Placeholder { ?   /here/and/there}!'))
      Assert.ok(has({ a: '#{?/here }', b: 44, c: true, d: [] }))
      Assert.ok(has({ a: '', b: 44, c: true, d: ['{?/here }!'] }))
    })

    it('Complex placeholders', () => {
      Assert.ok(has('Placeholder {  ?   here   :   default   }!'))
      Assert.ok(has('Placeholder {?here:default}!'))
      Assert.ok(has('Placeholder {\t?\there\t|\texp:\t5\t}!'))
      Assert.ok(has('Placeholder {?here|exp:5}!'))
      Assert.ok(has('Placeholder {  ?  here  :  1234  |  exp:  5,  a:  1  }!'))
      Assert.ok(has('Placeholder {\t?\there\t:\t1234\t|\texp:\t5,\ta:\t1\t}!'))
      Assert.ok(has('Placeholder {?here:1234|exp:5,a:1}!'))
      Assert.ok(has({ a: '{?here:1234|exp:5,a:1}', b: 44, c: true, d: [] }))
      Assert.ok(has({ a: '', b: 44, c: true, d: ['{?here:1234|exp:5,a:1}!'] }))
   })
  })

  describe('resolve', function() {
    it('First argument can be anything', function() {
      expect(resolve(5, {}, {})).to.be.eq(5)
      expect(resolve(true, {}, {})).to.be.true
      expect(resolve(undefined, {}, {})).to.be.undefined
      expect(resolve(null, {}, {})).to.be.eq(null)
    })
    describe('String argument', () => {
      it('Default replacement, simple value puts the exact value', function() {
          Assert.strictEqual(resolve('Hello, {?.}', 'John'), 'Hello, John')
          Assert.strictEqual(resolve('3 + 3 = {?./}', 6), '3 + 3 = 6')
      })
      it('Default replacement, null & undefined puts the default', function() {
        Assert.strictEqual(resolve('Hello, {?.:Lucas}'), 'Hello, Lucas')
        Assert.strictEqual(resolve('Hello, {?x/y:77}', {x: {}}), 'Hello, 77')
        Assert.strictEqual(resolve('Hello, {?x/y:true |}', {x: {y: null}}), 'Hello, true')
        Assert.strictEqual(resolve('Hello, {?x/y:Lucas | a: b}', {x: {y: undefined}}), 'Hello, Lucas')
      })
      it('Default replacement, empty values do not put the default', function() {
        Assert.strictEqual(resolve('Hello, {?.:Lucas}', ''), 'Hello, ')
        Assert.strictEqual(resolve('Hello, {?x/y:Lucas}', {x: {y: []}}), 'Hello, ')
        Assert.strictEqual(resolve('Hello, {?x/y:Lucas}', {x: {y: ''}}), 'Hello, ')
        Assert.strictEqual(resolve('Hello, {?x/y:Lucas}', {x: {y: 0}}), 'Hello, 0')
        Assert.strictEqual(resolve('3 - 3 = {?./ : error}', 0), '3 - 3 = 0')
      })
      it('Custom replacement receive default value and metadata', function() {
        const replacer = (value, expression, metadata) => JSON.stringify([value, expression, metadata])
        Assert.strictEqual(
          resolve(
            "#{? . : Lucas | a: 5, b: 'b' }#", 'Hello', { replacer }),
            '#["Hello",".",{"a":5,"b":"b"}]#')
        Assert.strictEqual(
          resolve(
            "#{? . : Lucas | ['Hello', 5] }#", undefined, { replacer }),
            '#["Lucas",".",["Hello",5]]#')
        Assert.strictEqual(
          resolve(
            "#{? . | ['Hello', 5] }#", undefined, { replacer }),
            '#[null,".",["Hello",5]]#')
        Assert.strictEqual(
          resolve(
            "#{? . : 1234 |  }#", undefined, { replacer }),
            '#[1234,".",null]#')
      })
      it('Default replacement, complex values puts the exact value', function() {
          let person = {
              name: 'John',
              lastName: 'Harris',
              age: 19,
              children: [
                  { name: 'Matt' },
                  { name: 'Phil' }
              ],
              skills: ['developer', 'writter']
          }

          let text =
          `{?name} has {?children/length} kids. One is named {? ./children/0/name } and the other {?./children/1/name | metadata: Hello}.
          {?./name:} is {?age} y.o. and he is a {?./skills/0} and a {?skills/1|}. He's friend name is {?./friend/name : | }`

          let expected =
          `John has 2 kids. One is named Matt and the other Phil.
          John is 19 y.o. and he is a developer and a writter. He's friend name is undefined`

          Assert.strictEqual(resolve(text, person), expected)
      })
      it('Custom replacement, nested value uses replacer', function() {
          Assert.strictEqual(resolve('Hello, {?./name}!', { name: 'John' }, { replacer: value => value.toUpperCase() }), 'Hello, JOHN!')
      })
      it('Environment variable, default options, var is not resolved', function() {
          process.env.MY_FAKE_VAR = 'the var value'
          const resolved = resolve('MY_FAKE_VAR = {? $MY_FAKE_VAR }')
          Assert.strictEqual(resolved, 'MY_FAKE_VAR = undefined')
      })
      it('Custom replacement, environment variable, trusted: true, var is resolved', function() {
        process.env.MY_FAKE_VAR = 'the var value'
        const resolved = resolve(
          'MY_FAKE_VAR = {? $MY_FAKE_VAR }',
          null,
          {
            trusted: true,
            replacer: value => `"${value}"`
          }
        )
        Assert.strictEqual(resolved, 'MY_FAKE_VAR = "the var value"')
      })
      it('Custom replacer, environment variable, trusted: false, var is not resolved. Error is not thrown but logged', function() {
          process.env.MY_FAKE_VAR = 'the var value'
          Assert.strictEqual(resolve('MY_FAKE_VAR = {? $MY_FAKE_VAR }', {}, {trusted: false, replacer: value => `"${value}"`}), 'MY_FAKE_VAR = "undefined"')
      })
    })
    describe('Object', function() {
      it('Objects with nested properties are resolved and non strings are untouched. Original is not modified', function() {
          let object = {
              a: 'value {?$MY_FAKE_VAR}',
              b: {
                  c: [true, false, 'value {?.}'],
                  d: 77
              }
          }
          let json = JSON.stringify(object)

          process.env.MY_FAKE_VAR = 'FakeVar'

          let expected = {
              a: 'value FakeVar',
              b: {
                  c: [true, false, 'value true'],
                  d: 77
              }
          }

          let result = resolve(object, true, { trusted: true })

          Assert.deepStrictEqual(result, expected)

          delete process.env.MY_FAKE_VAR

          expected = {
              a: 'value undefined',
              b: {
                  c: [true, false, 'value 6'],
                  d: 77
              }
          }

          result = resolve(object, 6, { trusted: true })

          Assert.deepStrictEqual(result, expected)

          Assert.strictEqual(JSON.stringify(object), json)
      })
      it('Option trusted: true resolve environment variables', function() {
          let object = {
              a: 'value {?$MY_FAKE_VAR}'
          }

          process.env.MY_FAKE_VAR = 'FakeVar'

          let expected = {
              a: 'value FakeVar'
          }

          let result = resolve(object, undefined, { trusted: true })

          Assert.deepStrictEqual(result, expected)
      })
      it('Option trusted: false does not resolve environment variables', function() {
          let object = {
              a: 'value {?$MY_FAKE_VAR}'
          }

          process.env.MY_FAKE_VAR = 'FakeVar'

          let expected = {
              a: 'value undefined'
          }

          let result = resolve(object, undefined, undefined, {trusted: false})

          Assert.deepStrictEqual(result, expected)
      })
      it('Replacement function is used', function() {
        let object = {
            a: '{? $MY_FAKE_VAR}',
            b: '{?.}'
        }

        process.env.MY_FAKE_VAR = true

        let expected = {
            a: 'string',
            b: 'boolean'
        }

        let result = resolve(object, false, { trusted: true, replacer: value => typeof(value) })

        Assert.deepStrictEqual(result, expected)
      })
    })
  })
  describe('Template', function() {
      it('Template with arbitrary values', function() {
          let template = Template(null)
          expect(template.hasPlaceholders()).to.be.false
          expect(template.placeholders()).to.have.lengthOf(0)
          expect(template({})).to.be.eq(null)

          template = Template(undefined)
          expect(template.hasPlaceholders()).to.be.false
          expect(template.placeholders()).to.have.lengthOf(0)
          expect(template({})).to.be.eq(undefined)

          template = Template(true)
          expect(template.hasPlaceholders()).to.be.false
          expect(template.placeholders()).to.have.lengthOf(0)
          expect(template({})).to.be.eq(true)

          template = Template(55)
          expect(template.hasPlaceholders()).to.be.false
          expect(template.placeholders()).to.have.lengthOf(0)
          expect(template({})).to.be.eq(55)
      })
      it('Template without placeholders', function() {
          let template = Template('Hello world')
          Assert.strictEqual(template(), 'Hello world')
          Assert.strictEqual(template('dummy'), 'Hello world')

          template = Template({ hello: 'world' })
          Assert.strictEqual(template().hello, 'world')
          Assert.strictEqual(template('dummy').hello, 'world')

          template = Template(['Hello world', 123])
          Assert.strictEqual(template().length, 2)
          Assert.strictEqual(template()[0], 'Hello world')
          Assert.strictEqual(template()[1], 123)
      })
      it('Template with placeholders', function() {
        let template = Template('Hello {?.}')
        Assert.strictEqual(template('world'), 'Hello world')
        Assert.strictEqual(template.hasPlaceholders(), true)

        template = Template(['Hello {?./0}{?/1:!}', 123])
        Assert.strictEqual(template(['world'])[0], 'Hello world!')
        Assert.strictEqual(template(['world'])[1], 123)
        Assert.strictEqual(template.hasPlaceholders(), true)

        template = Template([{ str: 'Hello {?who}{?/1:!}'}, 123])
        Assert.strictEqual(template({ who: 'world' })[0].str, 'Hello world!')
        Assert.strictEqual(template({ who: 'world' })[1], 123)
        Assert.strictEqual(template.hasPlaceholders(), true)
    })
  })
  describe('Placeholders', () => {
    it('Of string. No template.', () => {
      const phs = placeholders('Hello { ? who : 4} {? when | type: [day]}')
      expect(phs).to.have.lengthOf(2)

      expect(phs[0].expression).to.be.eq('who')
      expect(phs[0].defaultValue).to.be.eq(4)
      expect(phs[0].metadata).to.be.undefined

      expect(phs[1].expression).to.be.eq('when')
      expect(phs[1].defaultValue).to.be.undefined
      expect(phs[1].metadata.type[0]).to.be.eq('day')
    })
    it('Of string. Template.', () => {
      const template = Template('Hello { ? who : 4} {? when | type: [day]}')
      const phs = template.placeholders()

      expect(phs).to.have.lengthOf(2)

      expect(phs[0].expression).to.be.eq('who')
      expect(phs[0].defaultValue).to.be.eq(4)
      expect(phs[0].metadata).to.be.undefined

      expect(phs[1].expression).to.be.eq('when')
      expect(phs[1].defaultValue).to.be.undefined
      expect(phs[1].metadata.type[0]).to.be.eq('day')
    })
    it('Of object. No template.', () => {
      const phs = placeholders({
        name: 'John',
        age: 34,
        color: ['red', '{?color}'],
        pet: {
          type: '{? john/pet : dog | field: pet, count: 5}',
          name: 'Winston {?number:5|[hello]}'
        }
      })
      expect(phs).to.have.lengthOf(3)

      expect(phs[0].expression).to.be.eq('color')
      expect(phs[0].defaultValue).to.be.undefined
      expect(phs[0].metadata).to.be.undefined

      expect(phs[1].expression).to.be.eq('john/pet')
      expect(phs[1].defaultValue).to.be.eq('dog')
      expect(phs[1].metadata.field).to.be.eq('pet')
      expect(phs[1].metadata.count).to.be.eq(5)

      expect(phs[2].expression).to.be.eq('number')
      expect(phs[2].defaultValue).to.be.eq(5)
      expect(phs[2].metadata.length).to.be.eq(1)
      expect(phs[2].metadata[0]).to.be.eq('hello')
    })
    it('Of object. Template.', () => {
      const phs = Template({
        name: 'John',
        age: 34,
        color: ['red', '{?color}'],
        pet: {
          type: '{? john/pet : dog | field: pet, count: 5}',
          name: 'Winston {?number:5|[hello]}'
        }
      }).placeholders()

      expect(phs).to.have.lengthOf(3)

      expect(phs[0].expression).to.be.eq('color')
      expect(phs[0].defaultValue).to.be.undefined
      expect(phs[0].metadata).to.be.undefined

      expect(phs[1].expression).to.be.eq('john/pet')
      expect(phs[1].defaultValue).to.be.eq('dog')
      expect(phs[1].metadata.field).to.be.eq('pet')
      expect(phs[1].metadata.count).to.be.eq(5)

      expect(phs[2].expression).to.be.eq('number')
      expect(phs[2].defaultValue).to.be.eq(5)
      expect(phs[2].metadata.length).to.be.eq(1)
      expect(phs[2].metadata[0]).to.be.eq('hello')
    })
 })
})
