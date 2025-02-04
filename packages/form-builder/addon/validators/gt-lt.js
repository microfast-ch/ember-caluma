import getMessages from "ember-changeset-validations/utils/get-messages";
import buildMessage from "ember-changeset-validations/utils/validation-errors";

export default function validateGtLt(options = { gt: null, lt: null }) {
  return (key, newValue, oldValue, changes, content) => {
    newValue = Number(newValue);

    if (!newValue) {
      return true;
    }

    const messages = getMessages();
    const data = { ...content, ...changes };

    if (options.gt) {
      const dependentValue = data[options.gt];

      return dependentValue
        ? Number(newValue) > Number(dependentValue) ||
            buildMessage(key, {
              type: "greaterThan",
              value: newValue,
              context: {
                gt: messages.getDescriptionFor(options.gt),
              },
            })
        : true;
    }

    if (options.lt) {
      const dependentValue = data[options.lt];

      return dependentValue
        ? Number(newValue) < Number(dependentValue) ||
            buildMessage(key, {
              type: "lessThan",
              value: newValue,
              context: {
                lt: messages.getDescriptionFor(options.lt),
              },
            })
        : true;
    }

    return true;
  };
}
