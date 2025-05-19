(() => {
  const myHeaders = new Headers();
  myHeaders.append("X-TYPESENSE-API-KEY", process.env.TYPESENSE_API_KEY || "");

  const requestOptions: RequestInit = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow"
  };
  const searchParams = new URLSearchParams({
    q: "*",                     // Wildcard query to match all documents
    query_by: "title",          // Required parameter but not important for this use case
    facet_by: "categories.level3",         // Facet by the stores field
    per_page: "0",
    max_facet_values: "1000"
  });

  fetch(`http://typesense-app-autoscaling-lb-290518720.us-west-2.elb.amazonaws.com/collections/products2/documents/search?${searchParams.toString()}`, requestOptions)
    .then((response) => response.json())
    .then((result) => {
      console.log(result);
      const fs = require('node:fs');
      fs.writeFileSync('cook/facet.json', JSON.stringify(result, null, 2));
    })
    .catch((error) => console.error(error));

  fetch("http://typesense-app-autoscaling-lb-290518720.us-west-2.elb.amazonaws.com/collections/products2", {
    method: "GET",
    headers: myHeaders
  })
    .then(response => response.json())
    .then(result => {
      const fs = require('node:fs');
      fs.writeFileSync("cook/schema.json", JSON.stringify(result, null, 2));
    })
    .catch((error) => console.error(error));
})();
