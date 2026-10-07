/**
 * Default inventory checklist template for apartments.
 * Items are ordered by room, following the standard Hubigo
 * apartment inventory spreadsheet.
 */

export type TemplateItem = {
  name: string;
  quantity: number;
  notes?: string;
};

export const DEFAULT_APARTMENT_INVENTORY: TemplateItem[] = [
  // ── Entrance ──
  { name: "Keys + keychains (2 pcs)", quantity: 2 },
  { name: "Plexi with Hubigo", quantity: 1 },

  // ── Bedroom ──
  { name: "Kingsize bed + mattress", quantity: 1 },
  { name: "Set of duvets + pillows", quantity: 1 },
  { name: "Bedruner + decorative pillow", quantity: 1 },
  { name: "Curtains + shifon", quantity: 1 },
  { name: "Hangers", quantity: 23 },
  { name: "Remote for lamps", quantity: 2 },
  { name: "Decorations", quantity: 1 },
  { name: "Vase with flowers", quantity: 2 },
  { name: "TV", quantity: 1 },

  // ── Bathroom ──
  { name: "Hairdryer", quantity: 1 },
  { name: "Perfume bottles with sticks", quantity: 1 },
  { name: "Soapdishes", quantity: 1 },
  { name: "Toothbrush bottle", quantity: 1 },
  { name: "Vase with flowers (bathroom)", quantity: 1 },
  { name: "Bathroom bin", quantity: 1 },

  // ── Guest Bathroom ──
  { name: "Hairdryer (guest)", quantity: 0 },
  { name: "Perfume bottles with sticks (guest)", quantity: 0 },
  { name: "Soapdishes (guest)", quantity: 1 },
  { name: "Toothbrush bottle (guest)", quantity: 1 },
  { name: "Vase with flowers (guest bathroom)", quantity: 2 },
  { name: "Bathroom bin (guest)", quantity: 1 },

  // ── Kitchen ──
  { name: "Fridge", quantity: 1 },
  { name: "Washing machine", quantity: 1 },
  { name: "Dishwasher", quantity: 0 },
  { name: "Sandwich maker or toaster", quantity: 1 },
  { name: "Kettle", quantity: 1 },
  { name: "Oven", quantity: 1 },
  { name: "Coffee maker", quantity: 1 },
  { name: "Hood", quantity: 1 },
  { name: "Salad bowls", quantity: 1 },
  { name: "Decorative plate", quantity: 0, notes: "check quantity" },
  { name: "Tea and Coffee press", quantity: 1 },
  { name: "Set of big plates", quantity: 3 },
  { name: "Set of small plates", quantity: 5 },
  { name: "Small bowls", quantity: 0 },
  { name: "Big bowls", quantity: 6 },
  { name: "Saucers", quantity: 0 },
  { name: "Cutlery set", quantity: 6, notes: "6,6,6,6" },
  { name: "Support for cutlery", quantity: 1 },
  { name: "Support for knifes", quantity: 1 },
  { name: "Peeler", quantity: 1 },
  { name: "Scissors", quantity: 1 },
  { name: "Mugs", quantity: 3 },
  { name: "Glasses for water", quantity: 3 },
  { name: "Glasses for wine", quantity: 4 },
  { name: "Set of pots", quantity: 1 },
  { name: "Set of pans", quantity: 1 },
  { name: "Collander", quantity: 1 },
  { name: "Strainer", quantity: 1 },
  { name: "Grater", quantity: 1 },
  { name: "Utensils", quantity: 1 },
  { name: "Chopping board", quantity: 1 },
  { name: "Iron", quantity: 1, notes: "ABOVE HOOD" },
  { name: "Ironing board", quantity: 1, notes: "KITCHEN" },
  { name: "Dish drainer", quantity: 1 },
  { name: "Kitchen sink caddy", quantity: 1 },
  { name: "Microwave", quantity: 1 },
  { name: "Tea box", quantity: 1 },
  { name: "Kitchen bin", quantity: 1 },

  // ── Balcony ──
  { name: "Chairs (balcony)", quantity: 2 },
  { name: "Tables (balcony)", quantity: 1 },
  { name: "Ashtray", quantity: 1 },
  { name: "Laundry dryer", quantity: 1 },

  // ── Living Room ──
  { name: "Air freshener", quantity: 1 },
  { name: "Dining table", quantity: 2 },
  { name: "Chairs (living room)", quantity: 0, notes: "check quantity" },
  { name: "Sofa", quantity: 1 },
  { name: "Coffee table", quantity: 1 },
  { name: "Decorative pillows", quantity: 3 },
  { name: "Stand for TV", quantity: 1 },
  { name: "TV (living room)", quantity: 1 },
  { name: "Decorative tree", quantity: 1 },
  { name: "Curtains + shifon (living room)", quantity: 1 },
  { name: "Vase with flowers (living room)", quantity: 4 },
  { name: "Perfume bottles with sticks (living room)", quantity: 0 },
  { name: "Tissue box", quantity: 0 },
  { name: "Vacuum", quantity: 1, notes: "KITCHEN" },
  { name: "Universal sockets", quantity: 1 },
];
