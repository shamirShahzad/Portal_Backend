import fs from "fs";
import path from "path";
import pool from "./config";

type MigrationRow = {
  filename: string;
};

async function runMigrations() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
        CREATE TABLE IF NOT EXISTS migrations(
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
            `);

    const res = await client.query<MigrationRow>(
      ` SELECT filename FROM migrations`
    );
    const appliedMigrations = res.rows.map((row) => row.filename);

    const migrationDir = path.join(__dirname, "../migrations");
    const files = fs
      .readdirSync(migrationDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (!appliedMigrations.includes(file)) {
        const filePath = path.join(migrationDir, file);
        const sql = fs.readFileSync(filePath, "utf8");
        console.log(`Applying migration ${file}`);
        await client.query(sql);
        await client.query(`INSERT INTO migrations (filename) VALUES ($1)`, [
          file,
        ]);
      }
    }

    await client.query("COMMIT");
    console.log("All migrations applied");
  } catch (err) {
    await client.query("ROLLBACK");
    console.log("migrations failed", err);
  } finally {
    client.release();
  }
}

runMigrations();
