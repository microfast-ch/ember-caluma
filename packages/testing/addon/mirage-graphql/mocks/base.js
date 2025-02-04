import { camelize, dasherize } from "@ember/string";
import { MockList } from "graphql-tools";

import {
  Filter,
  Serializer,
  register,
} from "@projectcaluma/ember-testing/mirage-graphql";

export default class {
  constructor(type, collection, db, server, ...args) {
    this.type = type;
    this.collection = collection;
    this.db = db;
    this.server = server;

    this.filter = new Filter(type, collection, db, server, ...args);
    this.serializer = new Serializer(type, collection, db, server, ...args);
  }

  getHandlers() {
    const handlers = (target) => {
      const proto = Reflect.getPrototypeOf(target);
      const res = Object.values(proto);

      return Object.prototype.isPrototypeOf.call(
        Reflect.getPrototypeOf(proto),
        Object
      )
        ? res
        : [...handlers(proto), ...res];
    };

    return handlers(this).reduce((handlers, handler) => {
      if (typeof handler === "object" && handler.__isHandler) {
        return {
          ...handlers,
          // Mocks can have multiple handlers per type.
          ...handler.__handlerFor.reduce((targets, target) => {
            return {
              ...targets,
              [target.replace(/\{type\}/, this.type)]: (...args) =>
                handler.fn.apply(this, args),
            };
          }, {}),
        };
      }

      return handlers;
    }, {});
  }

  @register("{type}Connection")
  handleConnection(root, vars) {
    let records = this.filter.filter(
      this.collection,
      this.serializer.deserialize(vars)
    );

    const relKey = `${camelize(this.type)}Ids`;
    if (root && Object.prototype.hasOwnProperty.call(root, relKey)) {
      const ids = root[relKey];
      records = records.filter(({ id }) => ids && ids.includes(id));
    }

    // add base64 encoded index as cursor to records
    records = records.map((record, index) => ({
      ...record,
      _cursor: btoa(index),
    }));

    const lastCursor = records.slice(-1)[0]?._cursor;

    // extract next page of records
    if (vars.first) {
      const cursorIndex = vars.after
        ? records.findIndex((record) => record._cursor === vars.after) + 1
        : 0;
      records = records.slice(cursorIndex, cursorIndex + vars.first);
    }

    const endCursor = records.slice(-1)[0]?._cursor;
    const hasNextPage = lastCursor !== endCursor;

    return {
      pageInfo: () => {
        return { hasNextPage, endCursor };
      },
      edges: () =>
        new MockList(records.length, () => ({
          node: (r, v, _, meta) =>
            this.serializer.serialize(records[meta.path.prev.key]),
        })),
    };
  }

  @register("{type}")
  handle(root, vars) {
    // If the parent node already resolved this branch in the graph, return it
    // directly without mocking it
    if (
      root &&
      Object.prototype.hasOwnProperty.call(root, camelize(this.type))
    ) {
      return root[camelize(this.type)];
    }

    // If the parent node provides an ID for this relation, filter our mock data
    // with that given ID
    if (
      root &&
      Object.prototype.hasOwnProperty.call(root, `${camelize(this.type)}Id`)
    ) {
      vars = { id: root[`${camelize(this.type)}Id`] };
    }

    const record = this.filter.find(
      this.collection,
      this.serializer.deserialize(vars)
    );

    /* istanbul ignore next */
    if (!record) {
      // eslint-disable-next-line no-console
      return Error(
        `Did not find a record of type "${this.type}" in the store. Did you forget to create one?`
      );
    }

    return this.serializer.serialize(record);
  }

  @register("Save{type}Payload")
  handleSavePayload(_, { input: { clientMutationId, slug, id, ...args } }) {
    const identifier = slug ? { slug } : { id };

    const obj = this.filter.find(this.collection, identifier);
    const res = obj
      ? this.collection.update(obj.id, args)
      : this.collection.insert(
          this.serializer.deserialize(
            this.server.build(dasherize(this.type), {
              ...identifier,
              ...args,
            })
          )
        );

    const x = {
      [camelize(this.type)]: this.serializer.serialize(res),
      clientMutationId,
    };

    return x;
  }
}
