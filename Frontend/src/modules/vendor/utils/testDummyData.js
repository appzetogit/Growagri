/**
 * Vendor data is now strictly managed via live Backend APIs and MongoDB.
 * Local dummy data scripts are permanently disabled.
 */
export const checkVendorData = () => {
  return { status: 'Using live backend APIs' };
};
