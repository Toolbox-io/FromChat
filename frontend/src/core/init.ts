/**
 * @fileoverview Application initialization logic
 * @description Handles initial application setup and state
 * @author FromChat Team
 * @version 1.0.0
 */

import { showLogin } from "../navigation";
import { id } from "../utils/utils";
import { PRODUCT_NAME } from "./config";

showLogin();
id("productname").textContent = PRODUCT_NAME;
document.title = PRODUCT_NAME;