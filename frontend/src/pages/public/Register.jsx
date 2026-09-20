import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LocationSearch from '../../components/common/LocationSearch';
import LocationPicker from '../../components/common/LocationPicker';
import { authApi } from '../../api/authApi';
import { Loader2, CheckCircle2, AlertCircle, MapPin, Check } from 'lucide-react';

export default function Register() {
  const [selectedRole, setSelectedRole] = useState('CUSTOMER');
  
  // Section A: Owner / Common Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Customer Specific Location & Address Fields
  const [customerHouse, setCustomerHouse] = useState('');
  const [customerStreet, setCustomerStreet] = useState('');
  const [customerLandmark, setCustomerLandmark] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerDistrict, setCustomerDistrict] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [customerPincode, setCustomerPincode] = useState('');
  const [confirmedCustomerLocation, setConfirmedCustomerLocation] = useState(null);

  // PIN Code Lookup State
  const [pinLoading, setPinLoading] = useState(false);
  const [pinStatus, setPinStatus] = useState(null); // { type: 'success'|'warning'|'error', message: string, postOffices?: string }
  const pinAbortControllerRef = useRef(null);

  // Customer Specific Fields
  const [foodPreferences, setFoodPreferences] = useState(['Vegetarian']);

  // Section B: Restaurant Information
  const [restaurantName, setRestaurantName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisineType, setCuisineType] = useState('Multi-Cuisine');
  const [restaurantContact, setRestaurantContact] = useState('');
  const [restaurantEmail, setRestaurantEmail] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [openingTime, setOpeningTime] = useState('10:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [logoUrl, setLogoUrl] = useState('');
  const [confirmedRestaurantLocation, setConfirmedRestaurantLocation] = useState(null);
  const [restaurantPinLoading, setRestaurantPinLoading] = useState(false);
  const [restaurantPinStatus, setRestaurantPinStatus] = useState(null);
  const [restaurantDistrict, setRestaurantDistrict] = useState('');
  const [restaurantState, setRestaurantState] = useState('');
  const restaurantPinAbortRef = useRef(null);

  // Section C: Verification Information
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [foodLicenseNumber, setFoodLicenseNumber] = useState('');
  const [verificationDocumentUrl, setVerificationDocumentUrl] = useState('');

  // Delivery Partner Specific Fields & Base Location
  const [vehicleType, setVehicleType] = useState('BIKE');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [verificationInfo, setVerificationInfo] = useState('');
  const [driverBaseAddress, setDriverBaseAddress] = useState('');
  const [driverCity, setDriverCity] = useState('');
  const [driverPincode, setDriverPincode] = useState('');
  const [driverDistrict, setDriverDistrict] = useState('');
  const [driverState, setDriverState] = useState('');
  const [confirmedDriverLocation, setConfirmedDriverLocation] = useState(null);
  const [driverPinLoading, setDriverPinLoading] = useState(false);
  const [driverPinStatus, setDriverPinStatus] = useState(null);
  const driverPinAbortRef = useRef(null);

  // NGO Specific Fields
  const [ngoName, setNgoName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [ngoAddress, setNgoAddress] = useState('');
  const [ngoCity, setNgoCity] = useState('');
  const [ngoPincode, setNgoPincode] = useState('');
  const [ngoDistrict, setNgoDistrict] = useState('');
  const [ngoState, setNgoState] = useState('');
  const [confirmedNgoLocation, setConfirmedNgoLocation] = useState(null);
  const [ngoPinLoading, setNgoPinLoading] = useState(false);
  const [ngoPinStatus, setNgoPinStatus] = useState(null);
  const ngoPinAbortRef = useRef(null);
  const [organizationInfo, setOrganizationInfo] = useState('');
  const [foodRescueInfo, setFoodRescueInfo] = useState('');

  // Form State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleCustomerPincodeChange = async (e) => {
    const rawVal = e.target.value;
    // 1. Accept only numeric digits, max length 6
    const numericVal = rawVal.replace(/\D/g, '').slice(0, 6);
    setCustomerPincode(numericVal);

    if (pinAbortControllerRef.current) {
      pinAbortControllerRef.current.abort();
    }

    if (numericVal.length < 6) {
      setPinStatus(null);
      setPinLoading(false);
      return;
    }

    // When exactly 6 numeric digits are entered:
    setPinLoading(true);
    setPinStatus(null);

    const controller = new AbortController();
    pinAbortControllerRef.current = controller;

    try {
      const result = await authApi.lookupPincode(numericVal, controller.signal);
      if (result && result.success) {
        // Auto-fill City/Town, District, State without overwriting existing manual edits permanently
        if (result.city) {
          setCustomerCity(result.city);
        }
        if (result.district) {
          setCustomerDistrict(result.district);
        }
        if (result.state) {
          setCustomerState(result.state);
        }

        const poNames = Array.isArray(result.postOffices) && result.postOffices.length > 0 
          ? result.postOffices.slice(0, 3).join(', ') + (result.postOffices.length > 3 ? ` +${result.postOffices.length - 3} more` : '')
          : '';

        setPinStatus({
          type: 'success',
          message: `Location found for PIN ${numericVal}${result.district ? ` (${result.district}, ${result.state})` : ''}`,
          postOffices: poNames
        });
      } else {
        setPinStatus({
          type: 'warning',
          message: result?.message || 'No location found for this PIN code.'
        });
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.warn('PIN lookup issue:', err);
      setPinStatus({
        type: 'error',
        message: 'Unable to verify PIN right now. You can enter the location manually.'
      });
    } finally {
      setPinLoading(false);
    }
  };

  const handleCustomerLocationSelect = (locCandidate) => {
    setSelectedLocation(locCandidate);
    if (locCandidate) {
      const details = locCandidate.addressDetails || {};
      
      // Auto-populate area / street if empty
      const detectedStreet = details.road || details.suburb || details.village || details.neighbourhood || (locCandidate.isParentArea ? locCandidate.matchedQuery : '');
      if (detectedStreet && !customerStreet) {
        setCustomerStreet(detectedStreet);
      }
      
      // Auto-populate city if empty
      const detectedCity = details.city || details.town || details.county || details.state_district || details.municipality || '';
      if (detectedCity && !customerCity) {
        setCustomerCity(detectedCity);
      }

      // Auto-populate district if empty
      const detectedDistrict = details.state_district || details.county || '';
      if (detectedDistrict && !customerDistrict) {
        setCustomerDistrict(detectedDistrict);
      }
      
      // Auto-populate state if empty
      if (details.state && !customerState) {
        setCustomerState(details.state);
      }
      
      // Auto-populate pincode if empty
      if (details.postcode && !customerPincode) {
        const cleanPin = details.postcode.replace(/\D/g, '').slice(0, 6);
        setCustomerPincode(cleanPin);
        if (cleanPin.length === 6) {
          setPinStatus({
            type: 'success',
            message: `Location linked for PIN ${cleanPin}${details.state_district ? ` (${details.state_district}, ${details.state || ''})` : ''}`
          });
        }
      }
    }
  };

  const handleCustomerLocationConfirm = (confirmedData) => {
    console.log('Location confirmed on map:', confirmedData);
    setConfirmedCustomerLocation(confirmedData);
    
    // Non-destructively populate city, district, state, pincode if empty
    if (confirmedData.city && !customerCity) {
      setCustomerCity(confirmedData.city);
    }
    if (confirmedData.district && !customerDistrict) {
      setCustomerDistrict(confirmedData.district);
    }
    if (confirmedData.state && !customerState) {
      setCustomerState(confirmedData.state);
    }
    if (confirmedData.pincode && !customerPincode) {
      setCustomerPincode(confirmedData.pincode);
    }
  };

  const handleRestaurantPincodeChange = async (e) => {
    const rawVal = e.target.value;
    const numericVal = rawVal.replace(/\D/g, '').slice(0, 6);
    setPincode(numericVal);

    if (restaurantPinAbortRef.current) {
      restaurantPinAbortRef.current.abort();
    }

    if (numericVal.length < 6) {
      setRestaurantPinStatus(null);
      setRestaurantPinLoading(false);
      return;
    }

    setRestaurantPinLoading(true);
    setRestaurantPinStatus(null);

    const controller = new AbortController();
    restaurantPinAbortRef.current = controller;

    try {
      const result = await authApi.lookupPincode(numericVal, controller.signal);
      if (result && result.success) {
        if (result.city && !city) {
          setCity(result.city);
        }
        if (result.district) {
          setRestaurantDistrict(result.district);
        }
        if (result.state) {
          setRestaurantState(result.state);
        }

        const poNames = Array.isArray(result.postOffices) && result.postOffices.length > 0 
          ? result.postOffices.slice(0, 3).join(', ') + (result.postOffices.length > 3 ? ` +${result.postOffices.length - 3} more` : '')
          : '';

        setRestaurantPinStatus({
          type: 'success',
          message: `Location identified for PIN ${numericVal}${result.district ? ` (${result.district}, ${result.state})` : ''}`,
          postOffices: poNames
        });
      } else {
        setRestaurantPinStatus({
          type: 'warning',
          message: result?.message || 'No location found for this PIN code.'
        });
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.warn('Restaurant PIN lookup issue:', err);
      setRestaurantPinStatus({
        type: 'error',
        message: 'Unable to verify PIN right now. You can enter the location manually.'
      });
    } finally {
      setRestaurantPinLoading(false);
    }
  };

  const handleRestaurantLocationConfirm = (confirmedData) => {
    console.log('Restaurant location confirmed on map:', confirmedData);
    setConfirmedRestaurantLocation(confirmedData);

    // Non-destructively populate city, pincode, state, restaurantAddress if empty
    if (confirmedData.city && !city) {
      setCity(confirmedData.city);
    }
    if (confirmedData.pincode && !pincode) {
      setPincode(confirmedData.pincode);
    }
    if (confirmedData.district && !restaurantDistrict) {
      setRestaurantDistrict(confirmedData.district);
    }
    if (confirmedData.state && !restaurantState) {
      setRestaurantState(confirmedData.state);
    }
    if (confirmedData.address && !restaurantAddress) {
      setRestaurantAddress(confirmedData.address);
    }
  };

  const handleNgoPincodeChange = async (e) => {
    const rawVal = e.target.value;
    const numericVal = rawVal.replace(/\D/g, '').slice(0, 6);
    setNgoPincode(numericVal);

    if (ngoPinAbortRef.current) {
      ngoPinAbortRef.current.abort();
    }

    if (numericVal.length < 6) {
      setNgoPinStatus(null);
      setNgoPinLoading(false);
      return;
    }

    setNgoPinLoading(true);
    setNgoPinStatus(null);

    const controller = new AbortController();
    ngoPinAbortRef.current = controller;

    try {
      const result = await authApi.lookupPincode(numericVal, controller.signal);
      if (result && result.success) {
        if (result.city && !ngoCity) {
          setNgoCity(result.city);
        }
        if (result.district) {
          setNgoDistrict(result.district);
        }
        if (result.state) {
          setNgoState(result.state);
        }

        const poNames = Array.isArray(result.postOffices) && result.postOffices.length > 0 
          ? result.postOffices.slice(0, 3).join(', ') + (result.postOffices.length > 3 ? ` +${result.postOffices.length - 3} more` : '')
          : '';

        setNgoPinStatus({
          type: 'success',
          message: `Location identified for PIN ${numericVal}${result.district ? ` (${result.district}, ${result.state})` : ''}`,
          postOffices: poNames
        });
      } else {
        setNgoPinStatus({
          type: 'warning',
          message: result?.message || 'No location found for this PIN code.'
        });
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.warn('NGO PIN lookup issue:', err);
      setNgoPinStatus({
        type: 'error',
        message: 'Unable to verify PIN right now. You can enter the location manually.'
      });
    } finally {
      setNgoPinLoading(false);
    }
  };

  const handleNgoLocationConfirm = (confirmedData) => {
    console.log('NGO location confirmed on map:', confirmedData);
    setConfirmedNgoLocation(confirmedData);

    // Non-destructively populate ngoCity, ngoPincode, ngoDistrict, ngoState, ngoAddress if empty
    if (confirmedData.city && !ngoCity) {
      setNgoCity(confirmedData.city);
    }
    if (confirmedData.pincode && !ngoPincode) {
      setNgoPincode(confirmedData.pincode);
    }
    if (confirmedData.district && !ngoDistrict) {
      setNgoDistrict(confirmedData.district);
    }
    if (confirmedData.state && !ngoState) {
      setNgoState(confirmedData.state);
    }
    if (confirmedData.address && !ngoAddress) {
      setNgoAddress(confirmedData.address);
    }
  };

  const handleDriverPincodeChange = async (e) => {
    const rawVal = e.target.value;
    const numericVal = rawVal.replace(/\D/g, '').slice(0, 6);
    setDriverPincode(numericVal);

    if (driverPinAbortRef.current) {
      driverPinAbortRef.current.abort();
    }

    if (numericVal.length < 6) {
      setDriverPinStatus(null);
      setDriverPinLoading(false);
      return;
    }

    setDriverPinLoading(true);
    setDriverPinStatus(null);

    const controller = new AbortController();
    driverPinAbortRef.current = controller;

    try {
      const result = await authApi.lookupPincode(numericVal, controller.signal);
      if (result && result.success) {
        if (result.city && !driverCity) {
          setDriverCity(result.city);
        }
        if (result.district) {
          setDriverDistrict(result.district);
        }
        if (result.state) {
          setDriverState(result.state);
        }

        const poNames = Array.isArray(result.postOffices) && result.postOffices.length > 0 
          ? result.postOffices.slice(0, 3).join(', ') + (result.postOffices.length > 3 ? ` +${result.postOffices.length - 3} more` : '')
          : '';

        setDriverPinStatus({
          type: 'success',
          message: `Location identified for PIN ${numericVal}${result.district ? ` (${result.district}, ${result.state})` : ''}`,
          postOffices: poNames
        });
      } else {
        setDriverPinStatus({
          type: 'warning',
          message: result?.message || 'No location found for this PIN code.'
        });
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.warn('Driver PIN lookup issue:', err);
      setDriverPinStatus({
        type: 'error',
        message: 'Unable to verify PIN right now. You can enter the location manually.'
      });
    } finally {
      setDriverPinLoading(false);
    }
  };

  const handleDriverLocationConfirm = (confirmedData) => {
    console.log('Driver base location confirmed on map:', confirmedData);
    setConfirmedDriverLocation(confirmedData);

    if (confirmedData.city && !driverCity) {
      setDriverCity(confirmedData.city);
    }
    if (confirmedData.pincode && !driverPincode) {
      setDriverPincode(confirmedData.pincode);
    }
    if (confirmedData.district && !driverDistrict) {
      setDriverDistrict(confirmedData.district);
    }
    if (confirmedData.state && !driverState) {
      setDriverState(confirmedData.state);
    }
    if (confirmedData.address && !driverBaseAddress) {
      setDriverBaseAddress(confirmedData.address);
    }
  };

  const handlePreferenceToggle = (pref) => {
    if (foodPreferences.includes(pref)) {
      setFoodPreferences(foodPreferences.filter(p => p !== pref));
    } else {
      setFoodPreferences([...foodPreferences, pref]);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // Password validation
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }

    // Customer Map Location Verification Guard
    if (selectedRole === 'CUSTOMER') {
      if (!confirmedCustomerLocation || !confirmedCustomerLocation.latitude || !confirmedCustomerLocation.longitude) {
        setError('Please pinpoint and click "Confirm Location" on the delivery map before completing registration.');
        return;
      }
    }

    // Restaurant Map Location & Operating Hours Verification Guard
    if (selectedRole === 'RESTAURANT') {
      if (!confirmedRestaurantLocation || !confirmedRestaurantLocation.latitude || !confirmedRestaurantLocation.longitude) {
        setError('Please pinpoint and click "Confirm Location" on the restaurant map before completing registration.');
        return;
      }
      if (!openingTime || !closingTime) {
        setError('Please select valid Opening Time and Closing Time for the restaurant.');
        return;
      }
      if (openingTime === closingTime) {
        setError('Opening time and Closing time cannot be identical. The kitchen would be permanently closed.');
        return;
      }
    }

    // NGO Map Location Verification Guard
    if (selectedRole === 'NGO') {
      if (!confirmedNgoLocation || !confirmedNgoLocation.latitude || !confirmedNgoLocation.longitude) {
        setError('Please pinpoint and click "Confirm Location" on the NGO location map before completing registration.');
        return;
      }
    }

    // Delivery Partner Base Location Verification Guard
    if (selectedRole === 'DELIVERY_PARTNER') {
      if (!confirmedDriverLocation || !confirmedDriverLocation.latitude || !confirmedDriverLocation.longitude) {
        setError('Please pinpoint and click "Confirm Location" on the base / service location map before completing registration.');
        return;
      }
    }

    setLoading(true);

    try {
      const backendRole = selectedRole === 'RESTAURANT' ? 'RESTAURANT_OWNER' : selectedRole;

      // Compute structured customer delivery address
      const structuredAddressParts = [
        customerHouse.trim(),
        customerStreet.trim(),
        customerLandmark.trim() ? `Near ${customerLandmark.trim()}` : '',
        customerCity.trim(),
        customerDistrict.trim() && customerDistrict.trim().toLowerCase() !== customerCity.trim().toLowerCase() ? customerDistrict.trim() : '',
        customerState.trim(),
        customerPincode.trim()
      ].filter(Boolean);

      const customerFullAddress = structuredAddressParts.length > 0
        ? structuredAddressParts.join(', ')
        : address.trim();

      const customerLocationReference = selectedLocation?.displayName 
        || (customerCity ? `${customerCity}, ${customerState || ''}`.trim() : '')
        || location 
        || address;

      const payload = {
        name: selectedRole === 'NGO' ? contactPerson || name : name,
        email,
        phone,
        password,
        address: selectedRole === 'CUSTOMER' ? customerFullAddress : (selectedRole === 'RESTAURANT' ? restaurantAddress || address : (selectedRole === 'NGO' ? ngoAddress || address : (selectedRole === 'DELIVERY_PARTNER' ? driverBaseAddress || address : address))),
        location: selectedRole === 'CUSTOMER' ? customerLocationReference : (selectedRole === 'RESTAURANT' ? (confirmedRestaurantLocation?.address || `${city}, ${pincode}` || location) : (selectedRole === 'NGO' ? (confirmedNgoLocation?.address || `${ngoCity}, ${ngoPincode}` || location) : (selectedRole === 'DELIVERY_PARTNER' ? (confirmedDriverLocation?.address || `${driverCity}, ${driverPincode}` || location) : location))),
        city: selectedRole === 'CUSTOMER' ? customerCity || null : (selectedRole === 'RESTAURANT' ? city : (selectedRole === 'NGO' ? ngoCity || null : (selectedRole === 'DELIVERY_PARTNER' ? driverCity || null : null))),
        pincode: selectedRole === 'CUSTOMER' ? customerPincode || null : (selectedRole === 'RESTAURANT' ? pincode : (selectedRole === 'NGO' ? ngoPincode || null : (selectedRole === 'DELIVERY_PARTNER' ? driverPincode || null : null))),
        latitude: selectedRole === 'RESTAURANT' ? confirmedRestaurantLocation.latitude : (selectedRole === 'CUSTOMER' ? confirmedCustomerLocation.latitude : (selectedRole === 'NGO' ? confirmedNgoLocation.latitude : (selectedRole === 'DELIVERY_PARTNER' ? confirmedDriverLocation.latitude : null))),
        longitude: selectedRole === 'RESTAURANT' ? confirmedRestaurantLocation.longitude : (selectedRole === 'CUSTOMER' ? confirmedCustomerLocation.longitude : (selectedRole === 'NGO' ? confirmedNgoLocation.longitude : (selectedRole === 'DELIVERY_PARTNER' ? confirmedDriverLocation.longitude : null))),
        restaurantLatitude: selectedRole === 'RESTAURANT' ? confirmedRestaurantLocation.latitude : null,
        restaurantLongitude: selectedRole === 'RESTAURANT' ? confirmedRestaurantLocation.longitude : null,
        customerLatitude: selectedRole === 'CUSTOMER' ? confirmedCustomerLocation.latitude : null,
        customerLongitude: selectedRole === 'CUSTOMER' ? confirmedCustomerLocation.longitude : null,
        ngoLatitude: selectedRole === 'NGO' ? confirmedNgoLocation.latitude : null,
        ngoLongitude: selectedRole === 'NGO' ? confirmedNgoLocation.longitude : null,
        ngoCity: selectedRole === 'NGO' ? (ngoCity || confirmedNgoLocation?.city || null) : null,
        ngoPincode: selectedRole === 'NGO' ? (ngoPincode || confirmedNgoLocation?.pincode || null) : null,
        driverBaseLatitude: selectedRole === 'DELIVERY_PARTNER' ? confirmedDriverLocation.latitude : null,
        driverBaseLongitude: selectedRole === 'DELIVERY_PARTNER' ? confirmedDriverLocation.longitude : null,
        baseLatitude: selectedRole === 'DELIVERY_PARTNER' ? confirmedDriverLocation.latitude : null,
        baseLongitude: selectedRole === 'DELIVERY_PARTNER' ? confirmedDriverLocation.longitude : null,
        driverBaseAddress: selectedRole === 'DELIVERY_PARTNER' ? (driverBaseAddress || address) : null,
        driverCity: selectedRole === 'DELIVERY_PARTNER' ? (driverCity || confirmedDriverLocation?.city || null) : null,
        driverPincode: selectedRole === 'DELIVERY_PARTNER' ? (driverPincode || confirmedDriverLocation?.pincode || null) : null,
        driverState: selectedRole === 'DELIVERY_PARTNER' ? (driverState || confirmedDriverLocation?.state || null) : null,
        locationSource: selectedRole === 'RESTAURANT' 
          ? (confirmedRestaurantLocation.locationSource || 'USER_CONFIRMED_MAP') 
          : (selectedRole === 'NGO'
            ? (confirmedNgoLocation.locationSource || 'USER_CONFIRMED_MAP')
            : (selectedRole === 'CUSTOMER' ? (confirmedCustomerLocation.locationSource || 'USER_CONFIRMED_MAP') : (selectedRole === 'DELIVERY_PARTNER' ? 'USER_CONFIRMED_MAP' : null))),
        roles: [backendRole],
        
        // Customer specific
        foodPreferences: selectedRole === 'CUSTOMER' ? foodPreferences : null,
        
        // Restaurant specific (Section B & C)
        restaurantName: selectedRole === 'RESTAURANT' ? restaurantName : null,
        description: selectedRole === 'RESTAURANT' ? description : null,
        restaurantAddress: selectedRole === 'RESTAURANT' ? restaurantAddress : null,
        restaurantLocation: selectedRole === 'RESTAURANT' ? (confirmedRestaurantLocation?.address || `${city}, ${pincode}`) : null,
        cuisineType: selectedRole === 'RESTAURANT' ? cuisineType : null,
        restaurantContact: selectedRole === 'RESTAURANT' ? restaurantContact || phone : null,
        restaurantEmail: selectedRole === 'RESTAURANT' ? restaurantEmail || email : null,
        openingTime: selectedRole === 'RESTAURANT' ? openingTime : null,
        closingTime: selectedRole === 'RESTAURANT' ? closingTime : null,
        logoUrl: selectedRole === 'RESTAURANT' ? logoUrl : null,
        businessRegistrationNumber: selectedRole === 'RESTAURANT' ? businessRegistrationNumber : null,
        foodLicenseNumber: selectedRole === 'RESTAURANT' ? foodLicenseNumber : null,
        verificationDocumentUrl: selectedRole === 'RESTAURANT' ? verificationDocumentUrl : null,

        // Delivery Partner specific
        vehicleType: selectedRole === 'DELIVERY_PARTNER' ? vehicleType : null,
        vehicleNumber: selectedRole === 'DELIVERY_PARTNER' ? vehicleNumber : null,
        verificationInfo: selectedRole === 'DELIVERY_PARTNER' ? verificationInfo : null,
        
        // NGO specific
        ngoName: selectedRole === 'NGO' ? ngoName : null,
        contactPerson: selectedRole === 'NGO' ? contactPerson || name : null,
        ngoAddress: selectedRole === 'NGO' ? ngoAddress : null,
        organizationInfo: selectedRole === 'NGO' ? organizationInfo : null,
        foodRescueInfo: selectedRole === 'NGO' ? foodRescueInfo : null
      };


      const userObj = await register(payload);

      if (userObj.status === 'ACTIVE' || userObj.approved) {
        navigate('/customer/dashboard');
      } else {
        navigate('/application-pending');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please verify your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const roleCards = [
    {
      id: 'CUSTOMER',
      icon: '🛒',
      title: 'Customer',
      tag: 'Instant Activation',
      tagColor: 'var(--accent-green)',
      desc: 'Order delicious meals, track deliveries with AI ETAs, and rescue surplus food.'
    },
    {
      id: 'RESTAURANT',
      icon: '🏪',
      title: 'Restaurant Owner',
      tag: 'Admin Approval Required',
      tagColor: '#f59e0b',
      desc: 'Register kitchen profile & credentials. Configure your live menu after Admin approval.'
    },
    {
      id: 'DELIVERY_PARTNER',
      icon: '🛵',
      title: 'Delivery Partner',
      tag: 'Admin Verification Required',
      tagColor: '#00f2fe',
      desc: 'Earn with dynamic route optimization, instant dispatch assignments, and flexible hours.'
    },
    {
      id: 'NGO',
      icon: '🤝',
      title: 'NGO Partner',
      tag: 'Admin Verification Required',
      tagColor: '#a855f7',
      desc: 'Participate in Smart Food Rescue, collect surplus meals from restaurants, and feed communities.'
    }
  ];

  return (
    <div className="container" style={{ maxWidth: '840px', marginTop: '2.5rem', marginBottom: '4rem' }}>
      <div className="card" style={{ borderColor: 'rgba(0, 242, 254, 0.3)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="badge badge-ai" style={{ marginBottom: '0.5rem' }}>🌱 Join the SmartEats Ecosystem</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginTop: '0.3rem' }}>Create Your SmartEats Account</h2>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
            Select your ecosystem role below to display your customized registration application.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.9rem', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Step 1: Account Type Cards */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.8rem' }}>
            STEP 1: SELECT ACCOUNT TYPE
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
            {roleCards.map((rc) => {
              const isSelected = selectedRole === rc.id;
              return (
                <div
                  key={rc.id}
                  onClick={() => setSelectedRole(rc.id)}
                  style={{
                    background: isSelected ? 'rgba(0, 242, 254, 0.08)' : '#1e293b',
                    border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--bg-card-border)'}`,
                    borderRadius: '14px',
                    padding: '1.1rem 0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{rc.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isSelected ? '#fff' : '#e2e8f0', marginBottom: '0.3rem' }}>
                      {rc.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', lineHeight: '1.4', marginBottom: '0.8rem' }}>
                      {rc.desc}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: rc.tagColor, background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '8px', border: `1px solid ${rc.tagColor}40` }}>
                      {rc.tag}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Informational Alert for Roles Requiring Admin Approval */}
        {selectedRole !== 'CUSTOMER' && (
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.9rem 1.2rem', borderRadius: '12px', marginBottom: '1.8rem', fontSize: '0.85rem', color: '#f59e0b', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <div>
              <strong>Admin Verification Workflow:</strong> Upon registration, your application status will be marked as <strong>PENDING</strong>. An Administrator will review your credentials before operational access is unlocked.
            </div>
          </div>
        )}

        {/* Step 2: Dynamic Form Fields */}
        <form onSubmit={handleRegister}>
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>

            {/* CUSTOMER FORM */}
            {selectedRole === 'CUSTOMER' && (
              <>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                  STEP 2: CUSTOMER DETAILS & DELIVERY LOCATION
                </h4>
                
                {/* Personal Information */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Full Name *</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Kumar" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Email Address *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@smarteats.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Phone Number *</label>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: '100%', maxWidth: '400px', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                </div>

                {/* Location Autocomplete Search Section */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem', borderRadius: '14px', marginBottom: '1.5rem' }}>
                  <div style={{ marginBottom: '0.9rem' }}>
                    <h5 style={{ color: '#fff', margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                      📍 Step 2A: Search Delivery Area / Location
                    </h5>
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.8rem', margin: '3px 0 0 0' }}>
                      Search your area, locality, or village to lock in precise geocoding coordinates.
                    </p>
                  </div>

                  <LocationSearch
                    address={address}
                    onAddressChange={(newAddr) => setAddress(newAddr)}
                    selectedLocation={selectedLocation}
                    onLocationSelect={handleCustomerLocationSelect}
                    label="Search Delivery Area / Street / Village"
                    placeholder="e.g. Harinathpur, Kaliganj, Nadia or Tansen Road, Durgapur"
                    required
                  />

                  {/* Step 2B: Detailed Address Inputs */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.2rem', marginTop: '1rem' }}>
                    <div style={{ marginBottom: '0.8rem' }}>
                      <h5 style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>
                        🏠 Step 2B: Detailed Address & Door Details
                      </h5>
                      <p style={{ color: 'var(--text-sub)', fontSize: '0.78rem', margin: '2px 0 0 0' }}>
                        Provide exact flat, building, and street details for accurate doorstep delivery.
                      </p>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Flat / House / Building / Floor *</label>
                        <input
                          type="text"
                          required
                          value={customerHouse}
                          onChange={(e) => setCustomerHouse(e.target.value)}
                          placeholder="e.g. Flat 4B, Building 12, Block C"
                          style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Area / Street / Sector / Village *</label>
                        <input
                          type="text"
                          required
                          value={customerStreet}
                          onChange={(e) => setCustomerStreet(e.target.value)}
                          placeholder="e.g. Tansen Road / Harinathpur"
                          style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Landmark (Optional)</label>
                        <input
                          type="text"
                          value={customerLandmark}
                          onChange={(e) => setCustomerLandmark(e.target.value)}
                          placeholder="e.g. Near City Center / Post Office"
                          style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Pincode *</label>
                          {pinLoading && (
                            <span style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></span>
                              Looking up PIN...
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          required
                          value={customerPincode}
                          onChange={handleCustomerPincodeChange}
                          placeholder="e.g. 713200 or 632014"
                          style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                        />
                        {pinStatus && (
                          <div
                            style={{
                              marginTop: '5px',
                              fontSize: '0.74rem',
                              color: pinStatus.type === 'success' ? '#34d399' : (pinStatus.type === 'error' ? '#f87171' : '#fbbf24'),
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {pinStatus.type === 'success' ? '✓' : (pinStatus.type === 'error' ? '⚠' : 'ℹ')} {pinStatus.message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>City / Town *</label>
                        <input
                          type="text"
                          required
                          value={customerCity}
                          onChange={(e) => setCustomerCity(e.target.value)}
                          placeholder="e.g. Durgapur"
                          style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>District</label>
                        <input
                          type="text"
                          value={customerDistrict}
                          onChange={(e) => setCustomerDistrict(e.target.value)}
                          placeholder="e.g. Paschim Bardhaman"
                          style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>State *</label>
                        <input
                          type="text"
                          required
                          value={customerState}
                          onChange={(e) => setCustomerState(e.target.value)}
                          placeholder="e.g. West Bengal"
                          style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem' }}
                        />
                      </div>
                    </div>

                    {/* Step 2C: Interactive Map Location Picker */}
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.2rem', marginTop: '1.2rem' }}>
                      <div style={{ marginBottom: '0.8rem' }}>
                        <h5 style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>
                          🗺️ Step 2C: Pinpoint Delivery Location on Map *
                        </h5>
                        <p style={{ color: 'var(--text-sub)', fontSize: '0.78rem', margin: '2px 0 0 0' }}>
                          Drag the marker to your exact doorstep or click "Use Current Location", then click "Confirm Location".
                        </p>
                      </div>

                      <LocationPicker
                        initialLocation={
                          selectedLocation?.latitude && selectedLocation?.longitude
                            ? {
                                latitude: parseFloat(selectedLocation.latitude),
                                longitude: parseFloat(selectedLocation.longitude),
                                address: selectedLocation.displayName || address,
                                city: customerCity,
                                district: customerDistrict,
                                state: customerState,
                                pincode: customerPincode
                              }
                            : null
                        }
                        showSearch={false}
                        title="Confirm Rooftop / Gate Location"
                        description="Adjust the pin marker to your exact residential gate or doorstep for delivery riders."
                        height="320px"
                        onLocationConfirm={handleCustomerLocationConfirm}
                        onLocationChange={(liveLoc) => {
                          if (confirmedCustomerLocation && (confirmedCustomerLocation.latitude !== liveLoc.latitude || confirmedCustomerLocation.longitude !== liveLoc.longitude)) {
                            setConfirmedCustomerLocation(null);
                          }
                        }}
                      />

                      {confirmedCustomerLocation ? (
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#34d399',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '0.6rem'
                          }}
                        >
                          <Check size={16} />
                          <div>
                            <strong>Delivery Location Confirmed:</strong> Lat {confirmedCustomerLocation.latitude?.toFixed(6)}, Lon {confirmedCustomerLocation.longitude?.toFixed(6)} ({confirmedCustomerLocation.locationSource || 'USER_CONFIRMED_MAP'})
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            color: '#fbbf24',
                            padding: '0.6rem 0.9rem',
                            borderRadius: '10px',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '0.6rem'
                          }}
                        >
                          <AlertCircle size={15} />
                          Please adjust the pin marker on the map and click <strong>"Confirm Location"</strong> to lock your coordinates.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1.2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '6px' }}>Food Dietary Preferences (Select tags)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['Vegetarian', 'Non-Veg', 'Vegan', 'Halal', 'Gluten-Free', 'Organic', 'Jain', 'High Protein'].map((pref) => {
                      const active = foodPreferences.includes(pref);
                      return (
                        <button
                          type="button"
                          key={pref}
                          onClick={() => handlePreferenceToggle(pref)}
                          style={{
                            background: active ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                            border: `1px solid ${active ? 'var(--accent-green)' : 'rgba(255,255,255,0.1)'}`,
                            color: active ? 'var(--accent-green)' : 'var(--text-sub)',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: active ? 700 : 500
                          }}
                        >
                          {active ? '✓ ' : '+ '} {pref}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* RESTAURANT OWNER FORM (Structured into Section A, B, and C) */}
            {selectedRole === 'RESTAURANT' && (
              <>
                {/* SECTION A */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    👤 Section A: Owner Account Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Owner Full Name *</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Kumar" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Owner Email Address *</label>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@gmail.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Owner Phone Number *</label>
                      <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>

                {/* SECTION B */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: '#f59e0b', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🏪 Section B: Restaurant Information & Kitchen Location
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Name *</label>
                      <input type="text" required value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="Durgapur Royal Biryani & Tandoor" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Cuisine / Food Category *</label>
                      <input type="text" required value={cuisineType} onChange={(e) => setCuisineType(e.target.value)} placeholder="Indian / Tandoor / Biryani" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Contact Phone</label>
                      <input type="tel" value={restaurantContact} onChange={(e) => setRestaurantContact(e.target.value)} placeholder="9876543210" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Authentic Dum Biryani, gourmet charcoal tandoori specials, and Mughlai curries." style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px', minHeight: '60px' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Physical Address / Street *</label>
                      <input type="text" required value={restaurantAddress} onChange={(e) => setRestaurantAddress(e.target.value)} placeholder="Near City Centre, Durgapur" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>City / Town *</label>
                      <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Durgapur" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>6-Digit PIN *</label>
                        {restaurantPinLoading && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Loader2 size={11} className="animate-spin" /> Verifying...
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={pincode}
                        onChange={handleRestaurantPincodeChange}
                        placeholder="713216"
                        style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }}
                      />
                      {restaurantPinStatus && (
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '0.74rem',
                            color: restaurantPinStatus.type === 'success' ? '#34d399' : (restaurantPinStatus.type === 'error' ? '#f87171' : '#fbbf24')
                          }}
                        >
                          {restaurantPinStatus.type === 'success' ? '✓' : (restaurantPinStatus.type === 'error' ? '⚠' : 'ℹ')} {restaurantPinStatus.message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interactive Restaurant Map & Rooftop Location Picker */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.2rem', marginTop: '1.2rem', marginBottom: '1.2rem' }}>
                    <LocationPicker
                      initialLocation={
                        confirmedRestaurantLocation?.latitude && confirmedRestaurantLocation?.longitude
                          ? {
                              latitude: confirmedRestaurantLocation.latitude,
                              longitude: confirmedRestaurantLocation.longitude,
                              address: confirmedRestaurantLocation.address || restaurantAddress,
                              city: city,
                              pincode: pincode
                            }
                          : (city || pincode || restaurantAddress
                            ? {
                                address: restaurantAddress,
                                city: city,
                                pincode: pincode
                              }
                            : null)
                      }
                      showSearch={true}
                      title="Pin Exact Restaurant / Kitchen Location"
                      description="Search locality or use GPS, then drag the pin marker (📍) to your kitchen or pickup counter entrance."
                      height="340px"
                      onLocationConfirm={handleRestaurantLocationConfirm}
                      onLocationChange={(liveLoc) => {
                        if (confirmedRestaurantLocation && (confirmedRestaurantLocation.latitude !== liveLoc.latitude || confirmedRestaurantLocation.longitude !== liveLoc.longitude)) {
                          setConfirmedRestaurantLocation(null);
                        }
                      }}
                    />

                    {confirmedRestaurantLocation ? (
                      <div
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#34d399',
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '0.6rem'
                        }}
                      >
                        <Check size={16} />
                        <div>
                          <strong>Restaurant Location Confirmed:</strong> Lat {confirmedRestaurantLocation.latitude?.toFixed(6)}, Lon {confirmedRestaurantLocation.longitude?.toFixed(6)} ({confirmedRestaurantLocation.locationSource || 'USER_CONFIRMED_MAP'})
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          color: '#fbbf24',
                          padding: '0.6rem 0.9rem',
                          borderRadius: '10px',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '0.6rem'
                        }}
                      >
                        <AlertCircle size={15} />
                        Please search or adjust the pin marker (📍) to your restaurant's exact pickup spot and click <strong>"Confirm Location"</strong>.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Opening Time *</label>
                      <input
                        type="time"
                        required
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                        style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px', colorScheme: 'dark' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Closing Time *</label>
                      <input
                        type="time"
                        required
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                        style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px', colorScheme: 'dark' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Logo / Image URL</label>
                      <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>

                {/* SECTION C */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-green)', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📑 Section C: Verification Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Business Registration Number *</label>
                      <input type="text" required value={businessRegistrationNumber} onChange={(e) => setBusinessRegistrationNumber(e.target.value)} placeholder="REG-TN-2023-889977" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Food / FSSAI License Number *</label>
                      <input type="text" required value={foodLicenseNumber} onChange={(e) => setFoodLicenseNumber(e.target.value)} placeholder="FSSAI-11223344556677" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Verification Document Summary / Notes</label>
                    <input type="text" value={verificationDocumentUrl} onChange={(e) => setVerificationDocumentUrl(e.target.value)} placeholder="Authorized municipal trade license & FSSAI certificate on file" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', background: 'rgba(0, 242, 254, 0.05)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.2)', marginBottom: '1.2rem' }}>
                  ℹ️ <strong>Note:</strong> Menu items are configured directly from your Restaurant Dashboard after Admin approval.
                </div>
              </>
            )}

            {/* DELIVERY PARTNER FORM */}
            {selectedRole === 'DELIVERY_PARTNER' && (
              <>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                  STEP 2: RIDER ACCOUNT & VEHICLE DETAILS
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rider Full Name *</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Suresh Kumar" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Email Address *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="driver@smarteats.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Phone Number *</label>
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 99887 76655" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Driving License / National ID Verification Number *</label>
                    <input type="text" required value={verificationInfo} onChange={(e) => setVerificationInfo(e.target.value)} placeholder="DL-KA-2023-99887711" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Vehicle Type *</label>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }}>
                      <option value="BIKE">🏍️ Motorbike</option>
                      <option value="SCOOTER">🛵 Scooter</option>
                      <option value="ELECTRIC_VEHICLE">⚡ Electric Vehicle (EV)</option>
                      <option value="BICYCLE">🚲 Eco Bicycle</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Vehicle License Plate Number *</label>
                    <input type="text" required value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA-01-AB-1234" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                {/* STEP 3: BASE / SERVICE LOCATION */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.2rem', marginTop: '0.5rem', marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', margin: 0, fontSize: '1.1rem' }}>
                      STEP 3: BASE / SERVICE LOCATION
                    </h4>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      Registration Reference
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                    Used as your registered/base service location. Your live location will be requested separately when you go online for deliveries.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Base Area / Locality / Street *</label>
                      <input type="text" required value={driverBaseAddress} onChange={(e) => setDriverBaseAddress(e.target.value)} placeholder="Koramangala 4th Block, 80 Feet Road" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>City / Town *</label>
                      <input type="text" required value={driverCity} onChange={(e) => setDriverCity(e.target.value)} placeholder="Bengaluru" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>6-Digit PIN *</label>
                        {driverPinLoading && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Loader2 size={11} className="animate-spin" /> Verifying...
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={driverPincode}
                        onChange={handleDriverPincodeChange}
                        placeholder="560034"
                        style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }}
                      />
                      {driverPinStatus && (
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '0.74rem',
                            color: driverPinStatus.type === 'success' ? '#34d399' : (driverPinStatus.type === 'error' ? '#f87171' : '#fbbf24')
                          }}
                        >
                          {driverPinStatus.type === 'success' ? '✓' : (driverPinStatus.type === 'error' ? '⚠' : 'ℹ')} {driverPinStatus.message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interactive Driver Base Map & Location Picker */}
                  <LocationPicker
                    initialLocation={
                      confirmedDriverLocation?.latitude && confirmedDriverLocation?.longitude
                        ? {
                            latitude: confirmedDriverLocation.latitude,
                            longitude: confirmedDriverLocation.longitude,
                            address: confirmedDriverLocation.address || driverBaseAddress,
                            city: driverCity,
                            pincode: driverPincode
                          }
                        : (driverCity || driverPincode || driverBaseAddress
                          ? {
                              address: driverBaseAddress,
                              city: driverCity,
                              pincode: driverPincode
                            }
                          : null)
                    }
                    showSearch={true}
                    title="Pin Base / Service Hub Location"
                    description="Search your primary operating hub or locality, then drag the pin (📍) to confirm your base reference location."
                    height="340px"
                    onLocationConfirm={handleDriverLocationConfirm}
                    onLocationChange={(liveLoc) => {
                      if (confirmedDriverLocation && (confirmedDriverLocation.latitude !== liveLoc.latitude || confirmedDriverLocation.longitude !== liveLoc.longitude)) {
                        setConfirmedDriverLocation(null);
                      }
                    }}
                  />

                  {confirmedDriverLocation ? (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '0.8rem',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={18} />
                        <span>
                          <strong>Base location confirmed:</strong> {confirmedDriverLocation.address || `${confirmedDriverLocation.latitude.toFixed(4)}, ${confirmedDriverLocation.longitude.toFixed(4)}`}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', background: '#10b981', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        READY
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#fbbf24',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '0.8rem',
                        fontSize: '0.8rem'
                      }}
                    >
                      <AlertCircle size={15} />
                      <span>Please pinpoint your base location on the map above and click "Confirm Location".</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* NGO FORM */}
            {selectedRole === 'NGO' && (
              <>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                  STEP 2: NGO PARTNER DETAILS
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>NGO Organization Name *</label>
                    <input type="text" required value={ngoName} onChange={(e) => setNgoName(e.target.value)} placeholder="Robin Hood Army Foundation" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Primary Contact Person *</label>
                    <input type="text" required value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Priya Sharma" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Official Email Address *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ngo@smarteats.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Contact Phone Number *</label>
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 80 8899 0011" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>NGO Operational Address / Street *</label>
                    <input type="text" required value={ngoAddress} onChange={(e) => setNgoAddress(e.target.value)} placeholder="Near City Centre, Durgapur" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>City / Town *</label>
                    <input type="text" required value={ngoCity} onChange={(e) => setNgoCity(e.target.value)} placeholder="Durgapur" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>6-Digit PIN *</label>
                      {ngoPinLoading && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Loader2 size={11} className="animate-spin" /> Verifying...
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={ngoPincode}
                      onChange={handleNgoPincodeChange}
                      placeholder="713216"
                      style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }}
                    />
                    {ngoPinStatus && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontSize: '0.74rem',
                          color: ngoPinStatus.type === 'success' ? '#34d399' : (ngoPinStatus.type === 'error' ? '#f87171' : '#fbbf24')
                        }}
                      >
                        {ngoPinStatus.type === 'success' ? '✓' : (ngoPinStatus.type === 'error' ? '⚠' : 'ℹ')} {ngoPinStatus.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive NGO Map & Location Picker */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.2rem', marginTop: '1.2rem', marginBottom: '1.2rem' }}>
                  <LocationPicker
                    initialLocation={
                      confirmedNgoLocation?.latitude && confirmedNgoLocation?.longitude
                        ? {
                            latitude: confirmedNgoLocation.latitude,
                            longitude: confirmedNgoLocation.longitude,
                            address: confirmedNgoLocation.address || ngoAddress,
                            city: ngoCity,
                            pincode: ngoPincode
                          }
                        : (ngoCity || ngoPincode || ngoAddress
                          ? {
                              address: ngoAddress,
                              city: ngoCity,
                              pincode: ngoPincode
                            }
                          : null)
                    }
                    showSearch={true}
                    title="Pin Exact NGO Location"
                    description="Search your NGO address or locality, use GPS, then drag the pin (📍) to the exact NGO office or food collection point."
                    height="340px"
                    onLocationConfirm={handleNgoLocationConfirm}
                    onLocationChange={(liveLoc) => {
                      if (confirmedNgoLocation && (confirmedNgoLocation.latitude !== liveLoc.latitude || confirmedNgoLocation.longitude !== liveLoc.longitude)) {
                        setConfirmedNgoLocation(null);
                      }
                    }}
                  />

                  {confirmedNgoLocation ? (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '0.6rem'
                      }}
                    >
                      <Check size={16} />
                      <div>
                        <strong>NGO Location Confirmed:</strong> Lat {confirmedNgoLocation.latitude?.toFixed(6)}, Lon {confirmedNgoLocation.longitude?.toFixed(6)} ({confirmedNgoLocation.locationSource || 'USER_CONFIRMED_MAP'})
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#fbbf24',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '0.6rem'
                      }}
                    >
                      <AlertCircle size={15} />
                      Please search or adjust the pin marker (📍) to your NGO's physical pickup/distribution point and click <strong>"Confirm Location"</strong>.
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Organization Type / Mission *</label>
                    <input type="text" required value={organizationInfo} onChange={(e) => setOrganizationInfo(e.target.value)} placeholder="Community Food Bank & Zero Waste Shelter" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Food Rescue & Distribution Capacity *</label>
                    <input type="text" required value={foodRescueInfo} onChange={(e) => setFoodRescueInfo(e.target.value)} placeholder="Capacity for 200+ surplus meals daily, cold chain van available" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>
              </>
            )}

            {/* Passwords (Common to all) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.2rem', marginBottom: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Create Password *</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Confirm Password *</label>
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
              </div>
            </div>

            <button type="submit" className="btn-action" disabled={loading} style={{ height: '48px', fontSize: '1rem' }}>
              {loading ? 'Submitting Registration Application...' : `Register as ${roleCards.find(r => r.id === selectedRole)?.title}`}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Sign In</Link>
        </p>

      </div>
    </div>
  );
}
