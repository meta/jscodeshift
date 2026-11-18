
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const getParser = require('./../../getParser');

const recast = require('recast');
const types = recast.types.namedTypes;

describe('VariableDeclarators', function() {
  let nodes;
  let Collection;
  let VariableDeclaratorCollection;

  beforeEach(function() {
    jest.resetModules();

    Collection = require('../../Collection');
    VariableDeclaratorCollection =  require('../VariableDeclarator');
    VariableDeclaratorCollection.register();

    nodes = [recast.parse([
      'var foo = 42;',
      'var bar = require("module");',
      'var baz = require("module2");',
      'function first() {',
      '  var x = bar;',
      '  bar.someMethod();',
      '  func1(bar);',
      '}',
      'function func1(bar) {',
      '  var bar = 21;',
      '}',
      'foo.bar();',
      'foo[bar]();',
      'bar.foo();',
      'function second() {',
      '  var blah;',
      '  var obj = {',
      '    blah: 4,',
      '    blah() {},',
      '  };',
      '  obj.blah = 3;',
      '  class A {',
      '    blah = 10',
      '    blah() {}',
      '  }',
      '}',
      'class Foo { @decorator\n*stuff() {} }',
      '<Component foo={foo} />',
    ].join('\n'), {parser: getParser()}).program];
  });

  describe('Traversal', function() {
    it('adds a root method to find variable declarators', function() {
      expect(Collection.fromNodes([]).findVariableDeclarators).toBeDefined();
    });

    it('finds all variable declarators', function() {
      const declarators = Collection.fromNodes(nodes).findVariableDeclarators();
      expect(declarators.getTypes()).toContain('VariableDeclarator');
      expect(declarators.length).toBe(7);
    });

    it('finds variable declarators by name', function() {
      const declarators = Collection.fromNodes(nodes)
        .findVariableDeclarators('bar');
      expect(declarators.length).toBe(2);
    });
  });

  describe('Filters', function() {
    it('finds module imports (require)', function() {
      const declarators = Collection.fromNodes(nodes)
        .findVariableDeclarators()
        .filter(VariableDeclaratorCollection.filters.requiresModule());

      expect(declarators.length).toBe(2);
    });

    it('finds module imports (require) by module name', function() {
      const declarators = Collection.fromNodes(nodes)
        .findVariableDeclarators()
        .filter(VariableDeclaratorCollection.filters.requiresModule('module'));

      expect(declarators.length).toBe(1);
    });

    it('accepts multiple module names', function() {
      const declarators = Collection.fromNodes(nodes)
        .findVariableDeclarators()
        .filter(VariableDeclaratorCollection.filters.requiresModule(
          ['module', 'module2']
        ));

      expect(declarators.length).toBe(2);
    });
  });

  describe('Transform', function() {
    it('renames variable declarations considering scope', function() {
      Collection.fromNodes(nodes)
        .findVariableDeclarators()
        .filter(VariableDeclaratorCollection.filters.requiresModule('module'))
        .renameTo('xyz');

      const identifiers =
        Collection.fromNodes(nodes)
        .find(types.Identifier, {name: 'xyz'});

      expect(identifiers.length).toBe(6);
    });

    it('does not rename things that are not variables', function() {
      Collection.fromNodes(nodes)
        .findVariableDeclarators('blah')
        .renameTo('blarg');

      const identifiers =
        Collection.fromNodes(nodes)
        .find(types.Identifier, {name: 'blarg'});

      expect(identifiers.length).toBe(1);
    });

    it('properly renames a shorthand property that was using the old variable name', function() {
      nodes = [recast.parse([
        'var foo = 42;',
        'var obj2 = {',
        '  foo,',
        '};',
      ].join('\n'), {parser: getParser()}).program];

      // Outputs:
      // var newFoo = 42;
      // var obj2 = {
      //   foo: newFoo,
      // };
      Collection.fromNodes(nodes)
        .findVariableDeclarators('foo').renameTo('newFoo');

      expect(
        Collection.fromNodes(nodes).find(types.Identifier, { name: 'newFoo' }).length
      ).toBe(2);
      expect(
        Collection.fromNodes(nodes).find(types.Identifier, { name: 'foo' }).length
      ).toBe(1);

      expect(
        Collection.fromNodes(nodes).find(types.Property).filter(prop => !prop.value.shorthand).length
      ).toBe(1);
      expect(
        Collection.fromNodes(nodes).find(types.Property).filter(prop => prop.value.shorthand).length
      ).toBe(0);
    });

    it('does not rename React component prop name', function () {
      Collection.fromNodes(nodes)
        .findVariableDeclarators('foo')
        .renameTo('xyz');

      const identifiers = Collection.fromNodes(nodes)
        .find(types.JSXIdentifier, { name: 'foo' });

      expect(identifiers.length).toBe(1);
    });

    it('does not rename JSX open and closing tags that start with a lowercase letter', function () {
      nodes = [recast.parse([
        'var span = useRef(null);',
        'var element = <span ref={span}></span>;',
      ].join('\n'), {parser: getParser()}).program];

      Collection.fromNodes(nodes)
        .findVariableDeclarators('span')
        .renameTo('spanRef');

      const identifiers = Collection.fromNodes(nodes)
        .find(types.JSXIdentifier, { name: 'spanRef' });

      expect(identifiers.length).toBe(0);
    });

    it('does rename JSX open and closing tags that are capitalized', function () {
      nodes = [recast.parse([
        'var Span = require("./Span");',
        'var span = useRef(null);',
        'var element = <Span ref={span}></Span>;',
      ].join('\n'), {parser: getParser()}).program];

      Collection.fromNodes(nodes)
        .findVariableDeclarators('Span')
        .renameTo('SpanComponent');

      const identifiers = Collection.fromNodes(nodes)
        .find(types.JSXIdentifier, { name: 'SpanComponent' });

      expect(identifiers.length).toBe(2);
    });

    describe('parsing with bablylon', function() {
      it('does not rename object property', function () {
        nodes = [
          recast.parse('var foo = 42; var obj = { foo: null };', {
            parser: getParser('babylon'),
          }).program
        ];
        Collection
          .fromNodes(nodes)
          .findVariableDeclarators('foo').renameTo('newFoo');

        expect(
          Collection.fromNodes(nodes).find(types.Identifier, { name: 'newFoo' }).length
        ).toBe(1);
        expect(
          Collection.fromNodes(nodes).find(types.Identifier, { name: 'foo' }).length
        ).toBe(1);
      })

      it('does not rename object method', function () {
        nodes = [
          recast.parse('var foo = 42; var obj = { foo() {} };', {
            parser: getParser('babylon'),
          }).program
        ];
        Collection
          .fromNodes(nodes)
          .findVariableDeclarators('foo').renameTo('newFoo');

        expect(
          Collection.fromNodes(nodes).find(types.Identifier, { name: 'newFoo' }).length
        ).toBe(1);
        expect(
          Collection.fromNodes(nodes).find(types.Identifier, { name: 'foo' }).length
        ).toBe(1);
      })

      it('does not rename class method', function () {
        nodes = [
          recast.parse('var foo = 42; class A { foo() {} }', {
            parser: getParser('babylon'),
          }).program
        ];
        Collection
          .fromNodes(nodes)
          .findVariableDeclarators('foo').renameTo('newFoo');

        expect(
          Collection.fromNodes(nodes).find(types.Identifier, { name: 'newFoo' }).length
        ).toBe(1);
        expect(
          Collection.fromNodes(nodes).find(types.Identifier, { name: 'foo' }).length
        ).toBe(1);
      })
    });

    describe('identifiers that are member or label names', function() {
      function rename(source, parser, oldName) {
        const ast = recast.parse(source, {parser: getParser(parser)});
        Collection.fromNodes([ast.program])
          .findVariableDeclarators(oldName)
          .renameTo('newName');
        return recast.print(ast).code;
      }

      it('does not rename TypeScript interface and type literal members', function() {
        expect(rename([
          'const name = 1;',
          'interface P { name: string; name(): void; [name]: number }',
          'type T = { name: number };',
          'foo(name);',
          'let t: typeof name;',
        ].join('\n'), 'ts', 'name')).toEqual([
          'const newName = 1;',
          'interface P { name: string; name(): void; [newName]: number }',
          'type T = { name: number };',
          'foo(newName);',
          'let t: typeof newName;',
        ].join('\n'));
      });

      it('does not rename TypeScript enum members and qualified type names', function() {
        expect(rename([
          'const A = 1;',
          'enum E { A = 2 }',
          'let e: E.A = E.A;',
          'foo(A);',
        ].join('\n'), 'ts', 'A')).toEqual([
          'const newName = 1;',
          'enum E { A = 2 }',
          'let e: E.A = E.A;',
          'foo(newName);',
        ].join('\n'));
      });

      it('does not rename abstract, accessor and private class members', function() {
        expect(rename([
          'const count = 1;',
          'abstract class A {',
          '  abstract count(): void;',
          '  accessor count = 0;',
          '  #count = count;',
          '  m() { return this.#count; }',
          '}',
        ].join('\n'), 'ts', 'count')).toEqual([
          'const newName = 1;',
          'abstract class A {',
          '  abstract count(): void;',
          '  accessor count = 0;',
          '  #count = newName;',
          '  m() { return this.#count; }',
          '}',
        ].join('\n'));
      });

      it('does not rename Flow object type members', function() {
        expect(rename([
          'const name = 1;',
          'type T = { name: number, name(): void };',
          'foo(name);',
        ].join('\n'), 'flow', 'name')).toEqual([
          'const newName = 1;',
          'type T = { name: number, name(): void };',
          'foo(newName);',
        ].join('\n'));
      });

      it('does not rename import.meta and new.target', function() {
        expect(rename([
          'const meta = {};',
          'const url = new URL("./a", import.meta.url);',
          'export default meta;',
        ].join('\n'), 'babylon', 'meta')).toEqual([
          'const newName = {};',
          'const url = new URL("./a", import.meta.url);',
          'export default newName;',
        ].join('\n'));
        expect(rename([
          'const target = 1;',
          'function F() { return new.target ? target : 0; }',
        ].join('\n'), 'babylon', 'target')).toEqual([
          'const newName = 1;',
          'function F() { return new.target ? newName : 0; }',
        ].join('\n'));
      });

      it('does not rename statement labels', function() {
        expect(rename([
          'const loop = 1;',
          'loop: for (;;) { if (loop) break loop; continue loop; }',
        ].join('\n'), 'babylon', 'loop')).toEqual([
          'const newName = 1;',
          'loop: for (;;) { if (newName) break loop; continue loop; }',
        ].join('\n'));
      });
    });
  });

});
