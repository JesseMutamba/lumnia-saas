/**
 * sectorConfig.js
 * Per-sector configuration for DynamicDashboard.
 * Each sector defines visual theming, KPI column matching, health scoring weights,
 * recommended chart types, and AI prompt context.
 */

export const SECTOR_CONFIG = {
  healthcare: {
    displayName: "Healthcare",
    accentColor: "#2E86AB",

    kpiMappings: [
      {
        label: "Revenue",
        columnKeywords: ["revenue", "income", "billing", "charges", "receipts"],
        unit: "$",
      },
      {
        label: "Patient Volume",
        columnKeywords: ["patient", "admission", "visit", "encounter", "discharge", "census"],
        unit: "patients",
      },
      {
        label: "Operating Cost",
        columnKeywords: ["opex", "operating cost", "expenses", "expenditure", "cost"],
        unit: "$",
      },
      {
        label: "Net Margin",
        columnKeywords: ["margin", "profit", "net income", "surplus", "ebitda"],
        unit: "$",
      },
      {
        label: "Bed Occupancy",
        columnKeywords: ["occupancy", "bed", "utilization", "capacity"],
        unit: "%",
      },
      {
        label: "Staff Cost",
        columnKeywords: ["staff", "labour", "labor", "payroll", "salary", "salaries", "wage"],
        unit: "$",
      },
    ],

    healthScoreWeights: {
      margin: 0.45,
      costControl: 0.35,
      growth: 0.20,
    },

    recommendedCharts: ["line", "area", "bar"],

    insightContext:
      "A healthcare operation where revenue is driven by patient volume and payer mix, with margin sensitive to staff costs and bed utilisation rates.",
  },

  energy: {
    displayName: "Energy",
    accentColor: "#E07B39",

    kpiMappings: [
      {
        label: "Production Output",
        columnKeywords: ["production", "output", "generation", "mwh", "gwh", "barrels", "bbl", "mcf", "boe"],
        unit: "units",
      },
      {
        label: "Revenue",
        columnKeywords: ["revenue", "income", "sales", "receipts"],
        unit: "$",
      },
      {
        label: "CAPEX",
        columnKeywords: ["capex", "capital expenditure", "investment", "development cost"],
        unit: "$",
      },
      {
        label: "OPEX",
        columnKeywords: ["opex", "operating cost", "operating expense", "lifting cost"],
        unit: "$",
      },
      {
        label: "Capacity Factor",
        columnKeywords: ["efficiency", "capacity factor", "utilisation", "utilization", "load factor"],
        unit: "%",
      },
      {
        label: "Emissions",
        columnKeywords: ["co2", "carbon", "emissions", "ghg", "greenhouse"],
        unit: "tCO2",
      },
    ],

    healthScoreWeights: {
      margin: 0.40,
      costControl: 0.30,
      growth: 0.30,
    },

    recommendedCharts: ["area", "line", "bar"],

    insightContext:
      "An energy business where production volumes, capital intensity, and commodity price exposure are the primary drivers of financial performance.",
  },

  hospitality: {
    displayName: "Hospitality",
    accentColor: "#9B59B6",

    kpiMappings: [
      {
        label: "Total Revenue",
        columnKeywords: ["revenue", "total revenue", "income", "sales", "turnover"],
        unit: "$",
      },
      {
        label: "RevPAR",
        columnKeywords: ["revpar", "rev par", "revenue per available", "revenue per room"],
        unit: "$",
      },
      {
        label: "Occupancy Rate",
        columnKeywords: ["occupancy", "occ rate", "occ%", "rooms sold", "occupied"],
        unit: "%",
      },
      {
        label: "Average Daily Rate",
        columnKeywords: ["adr", "average daily rate", "room rate", "average rate"],
        unit: "$",
      },
      {
        label: "F&B Revenue",
        columnKeywords: ["food", "beverage", "f&b", "restaurant", "catering", "banquet"],
        unit: "$",
      },
      {
        label: "Guest Satisfaction",
        columnKeywords: ["satisfaction", "nps", "score", "rating", "review", "feedback"],
        unit: "score",
      },
    ],

    healthScoreWeights: {
      margin: 0.35,
      costControl: 0.25,
      growth: 0.40,
    },

    recommendedCharts: ["bar", "line", "area"],

    insightContext:
      "A hospitality business where occupancy, ADR, and RevPAR are the core performance indicators and guest satisfaction drives repeat revenue.",
  },

  mining: {
    displayName: "Mining",
    accentColor: "#7F8C8D",

    kpiMappings: [
      {
        label: "Ore Processed",
        columnKeywords: ["ore", "tonnes", "processed", "throughput", "milled", "extracted"],
        unit: "t",
      },
      {
        label: "Head Grade",
        columnKeywords: ["grade", "assay", "head grade", "recovery", "g/t", "ppm"],
        unit: "g/t",
      },
      {
        label: "Revenue",
        columnKeywords: ["revenue", "income", "sales", "realised price"],
        unit: "$",
      },
      {
        label: "AISC",
        columnKeywords: ["aisc", "all-in sustaining", "all in sustaining", "cost per oz", "cost per ounce"],
        unit: "$/oz",
      },
      {
        label: "CAPEX",
        columnKeywords: ["capex", "capital", "development", "sustaining capex"],
        unit: "$",
      },
      {
        label: "OPEX / Tonne",
        columnKeywords: ["opex", "operating cost", "cost per tonne", "c1", "cash cost"],
        unit: "$/t",
      },
    ],

    healthScoreWeights: {
      margin: 0.50,
      costControl: 0.35,
      growth: 0.15,
    },

    recommendedCharts: ["bar", "area", "line"],

    insightContext:
      "A mining operation where ore grade, processing throughput, and all-in sustaining costs per ounce determine the margin against commodity spot prices.",
  },

  agriculture: {
    displayName: "Agriculture",
    accentColor: "#2C5F1A",

    kpiMappings: [
      {
        label: "Yield / Output",
        columnKeywords: ["yield", "production", "harvest", "output", "tonnes", "crop", "cpo", "ffb"],
        unit: "t",
      },
      {
        label: "Land Area",
        columnKeywords: ["ha", "hectare", "area", "land", "planted", "cultivated", "acreage"],
        unit: "ha",
      },
      {
        label: "Revenue",
        columnKeywords: ["revenue", "income", "sales", "receipts", "proceeds"],
        unit: "$",
      },
      {
        label: "OPEX",
        columnKeywords: ["opex", "operating cost", "operating expense", "field cost"],
        unit: "$",
      },
      {
        label: "Cost / Ha",
        columnKeywords: ["cost per ha", "opex per ha", "cost/ha", "opex/ha", "per hectare"],
        unit: "$/ha",
      },
      {
        label: "Net Margin",
        columnKeywords: ["margin", "profit", "net income", "net margin", "ebitda"],
        unit: "$",
      },
    ],

    healthScoreWeights: {
      margin: 0.40,
      costControl: 0.35,
      growth: 0.25,
    },

    recommendedCharts: ["area", "bar", "line"],

    insightContext:
      "An agricultural operation where yield per hectare, commodity prices, and input costs per tonne drive profitability across planting and harvest cycles.",
  },
};
