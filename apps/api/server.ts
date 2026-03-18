import { app } from "./app";
import { PORT } from "./utils/constant";

app.listen(PORT, () => {
  console.log("Server is running on port", PORT);
});
