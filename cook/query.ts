const myHeaders = new Headers();
myHeaders.append("X-TYPESENSE-API-KEY", process.env.TYPESENSE_API_KEY || "");

const requestOptions: RequestInit = {
  method: "GET",
  headers: myHeaders,
  redirect: "follow"
};

const searchParams = new URLSearchParams({
  q: "macbook",
  query_by: "title,repmodel",
  sort_by: "top:desc,percent_offer:desc",
  per_page: "5"
});

fetch(`http://typesense-app-autoscaling-lb-290518720.us-west-2.elb.amazonaws.com/collections/products2/documents/search?${searchParams.toString()}`, requestOptions)
  .then((response) => response.text())
  .then((result) => {
    const fs = require('node:fs');
    fs.writeFileSync('cook/out.json', result);
  })
  .catch((error) => console.error(error));