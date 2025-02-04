import Response from "ember-cli-mirage/response";

import config from "../config/environment";

import graphqlHandler from "@projectcaluma/ember-testing/mirage-graphql";

export default function () {
  this.urlPrefix = ""; // make this `http://localhost:8080`, for example, if your API is on a different server
  this.namespace = ""; // make this `/api`, for example, if your API is namespaced
  this.timing = 400; // delay for each request, automatically set to 0 during testing

  this.post(config.apollo.apiURL, graphqlHandler(this), 200);

  if (config.environment !== "production") {
    this.get("/versions.json", {}, 200);
  }

  this.put("/minio/upload/:filename", (scheme, request) => {
    if (request.params.filename.startsWith("fail")) {
      return new Response(500);
    }
    return new Response(200);
  });

  this.passthrough();
}
