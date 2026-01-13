/**
 * Create Square Subscription Plans for Toast Guardian Support Tiers
 * 
 * Usage:
 *   node scripts/create_square_plans.cjs --token <SQUARE_ACCESS_TOKEN> [--dry-run]
 */

const https = require("https");

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf("--" + name);
  if (idx === -1) return null;
  return args[idx + 1];
};
const hasFlag = (name) => args.includes("--" + name);

const SQUARE_ACCESS_TOKEN = getArg("token") || process.env.SQUARE_ACCESS_TOKEN;
const DRY_RUN = hasFlag("dry-run");
const USE_SANDBOX = hasFlag("sandbox");
const LOCATION_ID = getArg("location") || "L6GGMPCHFM6WR";

const API_HOST = USE_SANDBOX ? "connect.squareupsandbox.com" : "connect.squareup.com";
const API_VERSION = "2024-12-18";

const SUPPORT_PLANS = [
  { name: "Core Support Plan", tier: "core", monthlyPrice: 35000 },
  { name: "Professional Support Plan", tier: "professional", monthlyPrice: 50000 },
  { name: "Premium Support Plan", tier: "premium", monthlyPrice: 80000 }
];

function squareRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: API_HOST,
      port: 443,
      path: "/v2" + path,
      method: method,
      headers: {
        "Authorization": "Bearer " + SQUARE_ACCESS_TOKEN,
        "Square-Version": API_VERSION,
        "Content-Type": "application/json"
      }
    };
    if (data) options.headers["Content-Length"] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let responseBody = "";
      res.on("data", chunk => responseBody += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(responseBody);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject({ status: res.statusCode, body: json });
          }
        } catch (e) {
          reject({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testConnection() {
  console.log("\n[1/4] Testing Square API connection...");
  console.log("      Host: " + API_HOST);
  
  const result = await squareRequest("GET", "/locations");
  const locations = result.locations || [];
  
  console.log("      Connected successfully!");
  console.log("      Found " + locations.length + " location(s):");
  locations.forEach(loc => {
    console.log("        - " + loc.name + " (" + loc.id + ")");
  });
  return locations;
}

async function findExistingPlans() {
  console.log("\n[2/4] Checking for existing subscription plans...");
  
  try {
    const result = await squareRequest("POST", "/catalog/search", {
      object_types: ["SUBSCRIPTION_PLAN"]
    });
    
    const plans = result.objects || [];
    console.log("      Found " + plans.length + " existing subscription plan(s)");
    
    const existingPlans = {};
    for (const plan of plans) {
      const planData = plan.subscription_plan_data || {};
      const name = planData.name || plan.name || "";
      console.log("        - " + name + " (" + plan.id + ")");
      
      if (name.toLowerCase().includes("core")) existingPlans.core = plan;
      else if (name.toLowerCase().includes("professional")) existingPlans.professional = plan;
      else if (name.toLowerCase().includes("premium")) existingPlans.premium = plan;
    }
    return existingPlans;
  } catch (error) {
    console.error("      Search failed:", error.body?.errors?.[0]?.detail || error.message);
    return {};
  }
}

async function createSubscriptionPlan(plan, existingPlans) {
  if (existingPlans[plan.tier]) {
    console.log("      [SKIP] " + plan.name + " already exists (" + existingPlans[plan.tier].id + ")");
    return existingPlans[plan.tier];
  }
  
  if (DRY_RUN) {
    console.log("      [DRY-RUN] Would create: " + plan.name + " ($" + (plan.monthlyPrice / 100) + "/mo)");
    return null;
  }
  
  try {
    const result = await squareRequest("POST", "/catalog/object", {
      idempotency_key: "create-" + plan.tier + "-" + Date.now(),
      object: {
        type: "SUBSCRIPTION_PLAN",
        id: "#" + plan.tier + "_support_plan",
        subscription_plan_data: {
          name: plan.name,
          phases: [{
            cadence: "MONTHLY",
            recurring_price_money: { amount: plan.monthlyPrice, currency: "USD" }
          }]
        },
        present_at_location_ids: [LOCATION_ID]
      }
    });
    
    console.log("      [CREATED] " + plan.name);
    console.log("                ID: " + (result.catalog_object?.id || "N/A"));
    return result.catalog_object;
  } catch (error) {
    console.error("      [FAILED] " + plan.name + ":", error.body?.errors?.[0]?.detail || JSON.stringify(error.body));
    return null;
  }
}

function generateCodeUpdate(createdPlans) {
  console.log("\n[4/4] Generated Code Update");
  console.log("------------------------------------------------------------");
  console.log("Update functions/api/_shared/square.js with:\n");
  console.log("export const SUPPORT_PLAN_CATALOG_IDS = {");
  ["core", "professional", "premium"].forEach(tier => {
    const plan = createdPlans[tier];
    const id = plan ? ("\047" + plan.id + "\047") : "null";
    console.log("  " + tier + ": " + id + ",");
  });
  console.log("};");
  console.log("------------------------------------------------------------");
}

async function main() {
  console.log("================================================================");
  console.log("       Square Subscription Plans Setup                          ");
  console.log("       Toast Guardian Support Tiers                             ");
  console.log("================================================================");
  
  if (!SQUARE_ACCESS_TOKEN) {
    console.error("\nERROR: Square Access Token required!");
    console.error("Usage: node scripts/create_square_plans.cjs --token <EAAA...>\n");
    process.exit(1);
  }
  
  if (DRY_RUN) console.log("\n[DRY-RUN MODE] No changes will be made.\n");
  
  console.log("Environment: " + (USE_SANDBOX ? "SANDBOX" : "PRODUCTION"));
  console.log("Location ID: " + LOCATION_ID);
  
  try {
    await testConnection();
    const existingPlans = await findExistingPlans();
    
    console.log("\n[3/4] Creating subscription plans...");
    const createdPlans = { ...existingPlans };
    
    for (const plan of SUPPORT_PLANS) {
      const result = await createSubscriptionPlan(plan, existingPlans);
      if (result) createdPlans[plan.tier] = result;
    }
    
    generateCodeUpdate(createdPlans);
    console.log("\nDone!\n");
  } catch (error) {
    console.error("\nScript failed:", error);
    process.exit(1);
  }
}

main();
