import type { GatewayId } from "../../env";
import type { GatewayAdapter } from "../types";
import { clickbank } from "./clickbank";
import { digistore24 } from "./digistore24";
import { generic } from "./generic";
import { hotmart } from "./hotmart";
import { kiwify } from "./kiwify";
import { stripe } from "./stripe";

export const adapters: Record<GatewayId, GatewayAdapter> = { digistore24, hotmart, kiwify, stripe, clickbank, generic };
