import { env } from "./config/env.js";
import server from "./app.js";

server.listen(env.PORT, () => {
  console.log(
    `Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`
  );
});

export default server;
