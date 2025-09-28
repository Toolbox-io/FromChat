/**
 * @fileoverview Application initialization logic
 * @description Handles initial application setup and state
 * @author FromChat Team
 * @version 1.0.0
 */

import { PRODUCT_NAME } from "./config";
import { enableMapSet } from "immer";

document.title = PRODUCT_NAME;
enableMapSet();