const { TableClient } = require("@azure/data-tables");

const TABLE_NAME = "UsageCounters";
const CONNECTION_STRING = process.env.TABLES_CONNECTION_STRING || "UseDevelopmentStorage=true";

let client = null;
let tableReady = null;

function getTableClient() {
  if (!client) {
    client = TableClient.fromConnectionString(CONNECTION_STRING, TABLE_NAME, {
      allowInsecureConnection: true,
    });
  }
  if (!tableReady) {
    tableReady = client.createTable().catch((err) => {
      if (err.statusCode !== 409) throw err;
    });
  }
  return tableReady.then(() => client);
}

module.exports = { getTableClient };
