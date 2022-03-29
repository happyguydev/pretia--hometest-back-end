import app from "./server";

const start = async () => {
  try {
    const port = process.env.PORT || 4101;
    app.listen(port, () => console.log(`Server started on port ${port}`));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();
