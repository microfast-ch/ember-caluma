import Component from "@ember/component";
import { computed } from "@ember/object";
import { queryManager } from "ember-apollo-client";
import { task } from "ember-concurrency";

import allFormatValidatorsQuery from "@projectcaluma/ember-form-builder/gql/queries/all-format-validators.graphql";

export default Component.extend({
  apollo: queryManager(),

  init(...args) {
    this._super(...args);

    this.availableFormatValidators.perform();
  },

  availableFormatValidators: task(function* () {
    const formatValidators = yield this.apollo.watchQuery(
      { query: allFormatValidatorsQuery, fetchPolicy: "cache-and-network" },
      "allFormatValidators.edges"
    );
    return formatValidators.map((edge) => edge.node);
  }).drop(),

  validators: computed(
    "availableFormatValidators.lastSuccessful.value.[]",
    function () {
      return this.get("availableFormatValidators.lastSuccessful.value") || [];
    }
  ),

  selected: computed("value.[]", "validators.@each.slug", function () {
    return this.validators.filter((validator) =>
      (this.value || []).includes(validator.slug)
    );
  }),

  actions: {
    updateValidators(value) {
      this.update(value.map((validator) => validator.slug));
      this.setDirty();
    },
  },
});
