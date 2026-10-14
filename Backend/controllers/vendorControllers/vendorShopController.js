const Vendor = require('../../models/Vendor');

/**
 * Register/Update Shop Details
 */
const registerShop = async (req, res) => {
    try {
        const { shopName, shopAddress, shopLocation, shopLicense, licenseDocument, deliveryRadius } = req.body;
        
        if (!shopName || !shopAddress) {
            return res.status(400).json({ success: false, message: 'Shop Name and Address are required' });
        }

        let updateData = {
            'shopDetails.shopName': shopName,
            'shopDetails.shopAddress': shopAddress,
            'shopDetails.shopLocation': shopLocation,
            'shopDetails.shopLicense': shopLicense,
            'shopDetails.licenseDocument': licenseDocument,
            'shopDetails.storeApprovalStatus': 'pending',
            'shopDetails.isStoreApproved': false,
            'shopDetails.remarks': ''
        };

        if (deliveryRadius) {
            updateData['shopDetails.deliveryRadius'] = parseFloat(deliveryRadius) || 50;
        }

        if (shopLocation && shopLocation.lng && shopLocation.lat) {
            updateData.geoLocation = {
                type: 'Point',
                coordinates: [parseFloat(shopLocation.lng), parseFloat(shopLocation.lat)]
            };
        }

        const vendor = await Vendor.findByIdAndUpdate(
            req.user._id,
            { $set: updateData },
            { new: true }
        );

        if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

        res.status(200).json({ 
            success: true, 
            message: 'Shop registration submitted for admin approval',
            data: vendor.shopDetails 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Shop Status
 */
const getShopStatus = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.user._id).select('shopDetails');
        res.status(200).json({ success: true, data: vendor.shopDetails });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    registerShop,
    getShopStatus
};
