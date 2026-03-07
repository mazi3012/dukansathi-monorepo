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
 */
export const HSN_TAX_RATES = {
    "2501": 0,    // Salt
    "1512": 5,    // Oil
    "0405": 5,    // Butter
    "1904": 5,    // Noodles
    "1905": 18    // Biscuits
};

/**
 * Check if the transaction is Inter-State (IGST) or Intra-State (CGST+SGST)
 * @param {string} sellerGstin 
 * @param {string} buyerGstin 
 * @param {string} placeOfSupplyStateCode (Optional) 
 * @returns {boolean} True if inter-state
 */
export const isInterState = (sellerGstin, buyerGstin, placeOfSupplyStateCode = null) => {
    if (!sellerGstin) return false;

    const sellerCode = sellerGstin.substring(0, 2);
    let buyerCode = buyerGstin ? buyerGstin.substring(0, 2) : null;

    // If customer is unregistered or no gstin, use Place of Supply or default to Seller's state
    if (!buyerCode) {
        buyerCode = placeOfSupplyStateCode || sellerCode;
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
    calculate: ({ sellingPrice, quantity, hsnCode, sellerGstin, buyerGstin = null, placeOfSupply = null }) => {
        const taxableValue = sellingPrice * quantity;
        const totalGstRate = HSN_TAX_RATES[hsnCode] || 0;

        const isInterSet = isInterState(sellerGstin, buyerGstin, placeOfSupply);

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
