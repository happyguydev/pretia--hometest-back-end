// brilliant idea from https://github.com/ctrlplusb/prisma-pg-jest

const fs = require("fs");
const NodeEnvironment = require("jest-environment-node");
const { Client } = require("pg");

require("dotenv").config();

class PrismaTestEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
    this.schema = `test_${Math.random().toString().substring(2)}`;
    const databaseUrl = process.env.DATABASE_URL;
    const urlStem = databaseUrl.substring(0, databaseUrl.indexOf("?"));
    this.connectionString = `${urlStem}?schema=${this.schema}`;
  }

  async setup() {
    process.env.DATABASE_URL = this.connectionString;
    this.global.process.env.DATABASE_URL = this.connectionString;
    const client = new Client({
      connectionString: this.connectionString,
    });
    await client.connect();
    await client.query(`CREATE SCHEMA ${this.schema}`);
    const sql = fs.readFileSync("../initdb.d/init.sql", "utf8");
    // replace schema, split statements by newlines
    const statements = sql
      .replace(/public\./g, `${this.schema}.`)
      .split(/\n\n+/)
      .filter((s) => !s.startsWith("COPY"))
      .filter((s) => !s.includes("hdb_catalog"));
    await Promise.all(statements.map((s) => client.query(s)));
    await client.end();
    return super.setup();
  }

  async teardown() {
    const client = new Client({
      connectionString: this.connectionString,
    });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE`);
    await client.end();
  }
}

module.exports = PrismaTestEnvironment;
