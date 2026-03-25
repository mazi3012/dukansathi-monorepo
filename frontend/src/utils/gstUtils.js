/**
 * Indian GST State Codes Mapping (Based on 2011 Census framework)
 */
export const GST_STATE_CODES = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman & Diu",
    "26": "Dadra & Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh (Old)",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh (New)",
    "38": "Ladakh"
};

/**
 * Extract State from GSTIN
 * @param {string} gstin 
 * @returns {string|null} State name or null if invalid
 */
export const getStateFromGSTIN = (gstin) => {
    if (!gstin || gstin.length < 2) return null;
    const code = gstin.substring(0, 2);
    return GST_STATE_CODES[code] || null;
};

/**
 * HSN Mapping with corresponding GST Rates
 * Covers common kirana, medical, hardware items across all 5 GST slabs
 */
export const HSN_TAX_RATES = {
    // 0% GST — Essential items
    "0401": 0,    // Fresh milk
    "0713": 0,    // Dried leguminous vegetables (dal)
    "1001": 0,    // Wheat
    "1006": 0,    // Rice
    "0702": 0,    // Fresh tomatoes
    "0703": 0,    // Onions
    "2501": 0,    // Salt
    "0805": 0,    // Fresh fruits

    // 5% GST
    "0402": 5,    // Milk powder / condensed
    "0405": 5,    // Butter / ghee
    "1101": 5,    // Wheat flour (atta)
    "1512": 5,    // Edible oils
    "1701": 5,    // Sugar
    "1704": 5,    // Sugar confectionery
    "1904": 5,    // Noodles / pasta
    "0901": 5,    // Coffee / tea
    "2106": 5,    // Food preparations (masala mixes)
    "3004": 5,    // Medicines / pharma
    "4901": 5,    // Books / printed matter

    // 12% GST
    "1902": 12,   // Pasta / couscous
    "2009": 12,   // Fruit juices
    "2201": 12,   // Mineral water
    "3401": 12,   // Soap
    "3402": 12,   // Detergents
    "6810": 12,   // Cement articles

    // 18% GST
    "1905": 18,   // Biscuits / cakes / pastry
    "2103": 18,   // Sauces / ketchup
    "2104": 18,   // Soups
    "2202": 18,   // Flavoured drinks
    "3305": 18,   // Hair care (shampoo)
    "3306": 18,   // Oral care (toothpaste)
    "3307": 18,   // Deodorants
    "7318": 18,   // Screws / bolts / nuts (hardware)
    "7326": 18,   // Iron / steel articles
    "8544": 18,   // Wires / cables (electrical)
    "8536": 18,   // Switches / plugs (electrical)
    "3926": 18,   // Plastic articles
    "6109": 18,   // T-shirts / vests

    // 28% GST
    "2402": 28,   // Tobacco / cigarettes
    "2711": 28,   // LPG
    "8703": 28,   // Motor cars (luxury)
    "3303": 28,   // Perfumes
    "3304": 28,   // Beauty / cosmetics
    "2101": 28,   // Instant coffee / tea extracts
};

/**
 * Valid GST Slabs in India
 */
export const GST_SLABS = [0, 5, 12, 18, 28];

/**
 * Get the nearest valid GST slab from a given rate
 */
export const getGSTSlabFromRate = (rate) => {
    const numRate = parseFloat(rate) || 0;
    return GST_SLABS.reduce((prev, curr) =>
        Math.abs(curr - numRate) < Math.abs(prev - numRate) ? curr : prev
    );
};

/**
 * Validate Indian GSTIN format
 * Format: 2-digit state code + 10-char PAN + 1 entity number + Z + 1 check digit
 * Example: 22AAAAA0000A1Z5
 * @param {string} gstin
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateGSTIN = (gstin) => {
    if (!gstin) return { valid: false, error: 'GSTIN is required' };
    if (gstin.length !== 15) return { valid: false, error: 'GSTIN must be exactly 15 characters' };

    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!pattern.test(gstin)) return { valid: false, error: 'Invalid GSTIN format' };

    const stateCode = gstin.substring(0, 2);
    if (!GST_STATE_CODES[stateCode]) return { valid: false, error: `Invalid state code: ${stateCode}` };

    return { valid: true };
};

/**
 * Reverse mapping: State Name to Code
 */
export const STATE_NAME_TO_CODES = Object.entries(GST_STATE_CODES).reduce((acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
}, {});

/**
 * Check if the transaction is Inter-State (IGST) or Intra-State (CGST+SGST)
 * @param {string} sellerGstin 
 * @param {string} buyerGstin 
 * @param {string} placeOfSupply (Can be State Code "18" or State Name "Assam")
 * @returns {boolean} True if inter-state
 */
export const isInterState = (sellerGstin, buyerGstin, placeOfSupply = null) => {
    if (!sellerGstin) return false;

    const sellerCode = sellerGstin.substring(0, 2);
    let buyerCode = buyerGstin ? buyerGstin.substring(0, 2) : null;

    // If customer is unregistered or no gstin, determine buyerCode from placeOfSupply
    if (!buyerCode) {
        if (!placeOfSupply) {
            buyerCode = sellerCode;
        } else if (/^\d{2}$/.test(placeOfSupply)) {
            // It's already a 2-digit code
            buyerCode = placeOfSupply;
        } else {
            // It's likely a state name, try to map it
            buyerCode = STATE_NAME_TO_CODES[placeOfSupply.toLowerCase()] || sellerCode;
        }
    }

    return sellerCode !== buyerCode;
};

/**
 * TaxCalculator Module
 */
export const TaxCalculator = {
    /**
     * Calculate GST for an item
     * @param {Object} params
     * @param {number} params.sellingPrice - Unit price
     * @param {number} params.quantity - Quantity
     * @param {string} params.hsnCode - HSN Code of product
     * @param {string} params.sellerGstin - Store GSTIN
     * @param {string} params.buyerGstin - Customer GSTIN (Optional)
     * @param {string} params.placeOfSupply - State Code (Optional)
     * @returns {Object} JSON calculation details
     */
    calculate: ({ sellingPrice, quantity, hsnCode, sellerGstin, buyerGstin = null, placeOfSupply = null, forceInterState = false }) => {
        const taxableValue = sellingPrice * quantity;
        const totalGstRate = HSN_TAX_RATES[hsnCode] || 0;

        // forceInterState lets the user manually override auto GSTIN detection
        const isInterSet = forceInterState || isInterState(sellerGstin, buyerGstin, placeOfSupply);

        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;

        if (isInterSet) {
            igstAmount = (taxableValue * totalGstRate) / 100;
        } else {
            const splitRate = totalGstRate / 2;
            cgstAmount = (taxableValue * splitRate) / 100;
            sgstAmount = (taxableValue * splitRate) / 100;
        }

        const grandTotal = taxableValue + cgstAmount + sgstAmount + igstAmount;

        return {
            taxable_value: parseFloat(taxableValue.toFixed(2)),
            cgst_amount: parseFloat(cgstAmount.toFixed(2)),
            sgst_amount: parseFloat(sgstAmount.toFixed(2)),
            igst_amount: parseFloat(igstAmount.toFixed(2)),
            grand_total: parseFloat(grandTotal.toFixed(2)),
            gst_rate: totalGstRate,
            is_inter_state: isInterSet
        };
    }
};
