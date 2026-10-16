if (!process.env.POSTGRESS_DB_URL) {
  console.log("[env config] POSTGRESS_DB_URL is not exist");
  process.exit(1);
}

export const env = {
  POSTGRESS_DB_URL: process.env.POSTGRESS_DB_URL,
};
