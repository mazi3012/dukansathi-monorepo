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
 * Check if the transaction is Inter-State (IGST) or Intra-State (CGST+SGST)
 * @param {string} sellerGstin 
 * @param {string} buyerGstin 
 * @returns {boolean} True if inter-state
 */
export const isInterState = (sellerGstin, buyerGstin) => {
    if (!sellerGstin || !buyerGstin) return false; // Default to intra-state if one is missing
    return sellerGstin.substring(0, 2) !== buyerGstin.substring(0, 2);
};
