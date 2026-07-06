const { PortRecord, PartyPin, VcnPin } = require('../models');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

const generate6DigitPin = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const syncPins = async () => {
  try {
    console.log('--- Starting Shipping Party and Vessel PIN Synchronization ---');
    
    // 1. Sync Shipping Parties
    const uniquePartiesResult = await sequelize.query(`
      SELECT DISTINCT party_name 
      FROM PortRecords 
      WHERE party_name IS NOT NULL AND party_name != ""
    `, { type: QueryTypes.SELECT });
    
    const existingParties = await PartyPin.findAll({ attributes: ['party_name'] });
    const existingPartiesSet = new Set(existingParties.map(p => p.party_name));
    
    const partiesToInsert = [];
    uniquePartiesResult.forEach(row => {
      const pName = row.party_name.trim();
      if (pName && !existingPartiesSet.has(pName)) {
        partiesToInsert.push({
          party_name: pName,
          pin: generate6DigitPin()
        });
      }
    });
    
    if (partiesToInsert.length > 0) {
      console.log(`Generating PINs for ${partiesToInsert.length} new Shipping Parties...`);
      await PartyPin.bulkCreate(partiesToInsert);
    }
    
    // 2. Sync VCNs
    const uniqueVcnsResult = await sequelize.query(`
      SELECT DISTINCT vcn 
      FROM PortRecords 
      WHERE vcn IS NOT NULL AND vcn != ""
    `, { type: QueryTypes.SELECT });
    
    const existingVcns = await VcnPin.findAll({ attributes: ['vcn'] });
    const existingVcnsSet = new Set(existingVcns.map(v => v.vcn));
    
    const vcnsToInsert = [];
    uniqueVcnsResult.forEach(row => {
      const vcnVal = row.vcn.trim();
      if (vcnVal && !existingVcnsSet.has(vcnVal)) {
        vcnsToInsert.push({
          vcn: vcnVal,
          pin: generate6DigitPin()
        });
      }
    });
    
    if (vcnsToInsert.length > 0) {
      console.log(`Generating PINs for ${vcnsToInsert.length} new Vessels (VCNs)...`);
      await VcnPin.bulkCreate(vcnsToInsert);
    }
    
    console.log('--- Shipping Party and Vessel PIN Synchronization Complete! ---');
  } catch (error) {
    console.error('Error synchronizing portal PINs:', error);
  }
};

module.exports = {
  syncPins,
  generate6DigitPin
};
