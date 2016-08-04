/* Created by Jerry on 27/05/2014.
 * v1.0.0
 */
// Main and only controller for Australia ETA Visa form.
// Post of data to SF via API is in the $scope.submitRequest = function() {}
//

var app = angular.module("visaAusETA", ['ui.router', 'http-post-fix', 'directives', 'ngMessages', 'ngRoute', 'ui.bootstrap', 'ngSanitize', 'angularPayments' ]);

app.filter('object2Array', function() {
    // No idea what this does. Inherited from somewhere.
    return function (input) {
        var out = [];
        for (i in input) {
            out.push(input[i]);
        }
        return out;
    }
});

app.controller("formController", ['$scope', '$http', '$window', '$uibModal', '$log', function($scope, $http, $window, $uibModal, $log ) {

    $scope.loading = true;

    $scope.siteSpecific = setSiteSpecific();
    var leavingPageText = "Any changes or information you have entered will be lost if you continue.";
    if( !$scope.siteSpecific.debug ) {
        window.onbeforeunload = function(){
            if($scope.stage!='finish'){
                return leavingPageText;
            }
        }
    }

    $scope.forms = {};
// Overall Error and Info messages    TODO: Needed, or put html on the Form?
    $scope.etacallerr = "Your Australian Electronic Travel Authority (ETA) application cannot be completed on-line.";
    $scope.etaduplica = "Please contact Trailfinders on " + $scope.siteSpecific.telephone + " where one of our consultants will handle your application.<br />Your card has not been charged.";
    $scope.etaunknow = "Unknown Error - Please contact Trailfinders on " + $scope.siteSpecific.telephone + " where one of our consultants will handle your application.<br />Your card has not been charged.";
// Flags etc to indicate outcome of Post to Superfacts.
    $scope.NoHardError = true;				// If ever set to false, then we've had a terminal error, from which we can never proceed to Submit.
    $scope.NotYetSubmitted = true
    $scope.SuperfactsSuccess = false;
    $scope.SuperfactsError = false;
    $scope.SuperfactsErrorText = "<span></span>";
    $scope.msg = "";
    $scope.invalidCardDetails = true;

// Specific multi-field / one error ng-message holders.
// Each base object is associated with a $scope.$watchCollection function, with fields being bound to eg DOB.dd
    $scope.DOB = {};
    $scope.DOBErrors 				= {required: true, success: false};
    $scope.PassportIssued = {};
    $scope.PassportIssuedErrors 	= {required: true, success: false};
    $scope.PassportExpiry = {};
    $scope.PassportExpiryErrors 	= {required: true, success: false};
    $scope.PhoneDaytime = {};
    $scope.PhoneDaytimeErrors 		= {required: true, success: false};
    $scope.PhoneAlternative = {};
    $scope.PhoneAlternativeErrors 	= {required: true, success: false};
    $scope.PhoneMobile = {};
    $scope.PhoneMobileErrors 		= {required: true, success: false};
    $scope.CardExpiry = {};
    $scope.CardExpiryErrors 		= {required: true, success: false};

    $scope.OutsideAddress = {};
    $scope.OutsideAddress = { reside: $scope.siteSpecific.referer };

    $scope.visaAusETA = {};					// create "visaAusETA" Object to hold the values which will be Posted to Superfacts.
    // Set Defaults for data to be Posted. Case of the variable name is not important to Superfacts ... but is for the API logging.
    $scope.visaAusETA.version 		= '1';			// Let Superfacts know which code to use to process our Posted data.
    $scope.visaAusETA.AGTLogin 		= "TFWEB";		// Angular ignores Hidden fields, so set AGTLogin value here. I think this is the id used to log into Galileo.
    $scope.visaAusETA.OPTION		= $scope.siteSpecific.option;
    $scope.visaAusETA.Action		= "CHECK";		// TODO: Needed? Check that everything valid.
    $scope.visaAusETA.TESTVAR		= "1";

    $scope.whichAddressLookup = "UK";		// UK and Scot websites.
    if( $scope.siteSpecific.referer == "IE" ) whichAddressLookup = "IE";

    $scope.visaAusETA.CCPayment = visaAusETAPrices[0];		// Pickup default price from lkServices Computed Value on Form.
    $scope.TFBooking = "No";
    $scope.visaAusETA.PaySource = "TFWebsite"			// TODO: ???

    $scope.addressHasBeenSelected = false;
// Setup model data values for <Select> fields. get Functions are to be found in visaAusETA-appValues.js
//    $scope.phoneCountries = getPhoneCountryCodes();
    $scope.selectCountries = getCountries();
    $scope.selectMonths = getMonths();
    $scope.selectDays = getMonthDays( 31 );
    $scope.selectNationalities = getNationalities();

    $scope.selectDOBYears 			= getYearsLast( 100 );			// show last 100 years.
    $scope.selectIssuedYears 		= getYearsLast( 21 );			// show last 21 years.
    $scope.selectExpiryYears 		= getYearsNext( 21 );			// show next 21 years.
    $scope.selectCardExpiryMonths 	= getMonthsNumbers();
    $scope.selectCardExpiryYears 	= getYearsNext( 12 );			// show next 12 years.

// Accordion Section control.
    $scope.visaAusETASection1 = '';
    $scope.visaAusETASection2 = '';
    $scope.visaAusETASection3 = '';
    //Sections - these are used to control each Accordion and if they have been completed yet.
    $scope.sections=[
        {"sectionName":"section1","wizardPosition":0,"sectionFormName":"visaAusETASection1",	"mandatory":true,"completed":false, "isOpen":true, "focus":true, failedValidation:false},
        {"sectionName":"section2","wizardPosition":1,"sectionFormName":"visaAusETASection2",	"mandatory":true,"completed":false, "isOpen":false,"focus":false,failedValidation:false},
        {"sectionName":"section3","wizardPosition":2,"sectionFormName":"visaAusETASection3",	"mandatory":true,"completed":false, "isOpen":false,"focus":false,failedValidation:false},
        {"sectionName":"finished","wizardPosition":3,"sectionFormName":"",						"mandatory":false,"completed":false,"isOpen":false,"focus":false,failedValidation:false}
    ];

    $scope.wizardPosition=0;				//First section to display
    $scope.stage = 'section1' 				//First section to display. NB stage is used in setting onbeforeunload and watched in order to set focus to 1st field.
    $scope.sections[0].isOpen = true;

// Start of Call-back functions.
    //callback function from the addressLookup Directive for Address being selected from radio buttons in the PostCode lookup - passed an address object


    $scope.$on('ukaddress', function(evt, data) {
        $scope.addressSelected(data)
    });

    $scope.addressSelected = function(address) {
        console.log(address)
        var splitAddress = address.selectedAddress.split(",");
        for (var i = 0; i < splitAddress.length; i++) {
            $scope.visaAusETA['Address' + (i + 1)] = splitAddress[i].trim();
        }
        $scope.visaAusETA.POSTCODE = address.postcode.toUpperCase();
        $scope.addressHasBeenSelected = true;
//        For Ireland - grab EIRCODE from end of address
//        if( $scope.siteSpecific.referer==='IE'){
//        	$scope.visaAusETA.POSTCODE = splitAddress[splitAddress.length-1]
//        }
    }

    $scope.manualAddress=false;
    $scope.setManualAddress=function(){
        $scope.manualAddress = !$scope.manualAddress;
    }

    // set Defaults for non-required fields, as they may not exist in the Submitted form.
    $scope.visaAusETA.Identity_Number = '';
    $scope.visaAusETA.ALTCITIZENSHIPYESNO = 'NO';
    $scope.visaAusETA.AltCitizenShip1;					// set to null, as changing value then changing back to default, will set the value to null.
    $scope.visaAusETA.AltCitizenShip2;					// ditto.

    $scope.$watch( 'visaAusETA.TFBOOKINGNO', function(newVal, oldVal){
        // watch the TFBooking Reference field to see if user has entered a vaguely valid Booking Ref, and if so set the discounted price.
        if( newVal ) {
            if( newVal.length == 6 ) {
                $scope.visaAusETA.CCPayment = visaAusETAPrices[1];		// Pickup discounted price from lkServices Computed Value on Form.
            } else {
                $scope.visaAusETA.CCPayment = visaAusETAPrices[0];		// Reset back to default price from lkServices Computed Value on Form.
            }
        }
    });

    $scope.$watchCollection( 'OutsideAddress', function(newVal, oldVal){
        if( newVal != $scope.whichAddressLookup ) {
            $scope.whichAddressLookup = $scope.OutsideAddress.reside;
        }
        if( $scope.whichAddressLookup == "IE") {
            $scope.addressLookup_Label1 = "Partial Address";
            $scope.addressLookup_Placeholder1 = "enter your Eircode or partial address";
            $scope.addressLookup_Label2 = "Eircode";
        } else {
            $scope.addressLookup_Label1 = "Postcode";
            $scope.addressLookup_Placeholder1 = "enter your Postcode";
            $scope.addressLookup_Label2 = "Postcode";
        }
    })

    $scope.$watchCollection('DOB', function(newVal, oldVal){
        // Watch to see if any of the 3 fields bound to DOB. values change. If all entered then reset required error flag.
        if( newVal.dd != undefined && newVal.mm != undefined && newVal.yy != undefined ){
            $scope.DOBErrors.required = false;
        } else {
            $scope.DOBErrors.required = true;
        }
    })
    $scope.$watchCollection('PassportIssued', function(newVal, oldVal){
        // Watch to see if any of the 3 fields bound values change. If all entered then reset required error flag.
        if( newVal.dd != undefined && newVal.mm != undefined && newVal.yy != undefined ){
            $scope.PassportIssuedErrors.required = false;
        } else {
            $scope.PassportIssuedErrors.required = true;
        }
    })
    $scope.$watchCollection('PassportExpiry', function(newVal, oldVal){
        // watch to see if any of the 3 fields bound values change. If all entered then reset required error flag.
        if( newVal.dd != undefined && newVal.mm != undefined && newVal.yy != undefined ){
            $scope.PassportExpiryErrors.required = false;
        } else {
            $scope.PassportExpiryErrors.required = true;
        }
    })
    $scope.$watchCollection('PhoneDaytime', function(newVal, oldVal){
        // watch to see if any of the 3 fields bound values change. If all entered then reset required error flag.
        if( newVal.Country != undefined && newVal.Area != undefined && newVal.Phone != undefined ){
            $scope.PhoneDaytimeErrors.required = false;
        } else {
            $scope.PhoneDaytimeErrors.required = true;
        }
    })
    $scope.$watchCollection('PhoneAlternative', function(newVal, oldVal){
        // watch to see if any of the 3 fields bound values change. If all entered then reset required error flag.
        if( newVal.Country != undefined && newVal.Area != undefined && newVal.Phone != undefined ){
            $scope.PhoneAlternativeErrors.required = false;
        } else {
            $scope.PhoneAlternativeErrors.required = true;
        }
    })
    $scope.$watchCollection('PhoneMobile', function(newVal, oldVal){
        // watch to see if any of the 3 fields bound values change. If all entered then reset required error flag.
        if( newVal.Part1 != undefined && newVal.Part2 != undefined ){
            $scope.PhoneMobileErrors.required = false;
        } else {
            $scope.PhoneMobileErrors.required = true;
        }
    })
    $scope.$watchCollection('CardExpiry', function(newVal, oldVal){
        // watch to see if any of the 3 fields bound values change. If all entered then reset required error flag.
        if( newVal.mm != undefined && newVal.yy != undefined ){
            $scope.CardExpiryErrors.required = false;
        } else {
            $scope.CardExpiryErrors.required = true;
        }
    })

    $scope.isNationalityIdentityNumberNeeded = function(){
        var nat = $scope.visaAusETA.Nationality;
        if( nat =="BN Brunei"){ return true }
        if( nat =="DK Denmark"){ return true }
        if( nat =="FI Finland"){ return true }
        if( nat =="HK Hong Kong SAR (not BN(O))"){ return true }
        if( nat =="LU Luxembourg"){ return true }
        if( nat =="MY Malaysia"){ return true }
        if( nat =="NL The Netherlands"){ return true }
        if( nat =="NO Norway"){ return true }
        if( nat =="PT Portugal"){ return true }
        if( nat =="SG Singapore"){ return true }
        if( nat =="KR South Korea"){ return true }
        if( nat =="ES Spain"){ return true }
        if( nat =="SE Sweden"){ return true }
        if( nat =="TW Taiwan"){ return true }
        return false
    }


    $scope.$watch("stage", function(newValue, oldValue) {
        // move focus to first field in the specified section.
        if( newValue != oldValue ) {
            if( newValue == 'section2' ) {
                $scope.sections[0].focus = false;
                $scope.sections[1].focus = true;
            } else if( newValue == 'section3' ) {
                $scope.sections[1].focus = false;
                $scope.sections[2].focus = true;
            }
        }
    })




//Helper Functions.
    //A helper function to determine if a section is been "valid", ie all required fields entered.
    $scope.isSectionValid = function(sectionNum){
        var form = $scope.forms[ $scope.sections[ sectionNum ].sectionFormName ];
        if( form != undefined ) {
            if( form.$valid ) {
                return true;
            }
        }
        return false;
    }
    //A helper function to determine if a section has been completed
    $scope.isSectionComplete = function(sectionNum){
        var sect = $scope.sections[ sectionNum ];
        if( sect != undefined ) {
            return sect.completed;
        }
        return false;
    }
    //A helper function to reset a section to not being completed.
    $scope.sectionMakeIncomplete = function( sectionNum ){
        var sect = $scope.sections[ sectionNum ];
        sect.completed = false;
    }
    $scope.nextSection=function(sectionNum){
        $scope.checking = true; //Used to display the loading symbol
        var currentSection = $scope.sections[ sectionNum - 1 ];
        var nextSection = $scope.sections[ sectionNum ];
        //Do we have a next section
        if( nextSection == undefined ){
            // TODO: ??? panic ???
            return;
        }
        if( !$scope.isSectionValid( sectionNum - 1 ) ){
            currentSection.failedValidation = true;
            currentSection.completed = false;
            $scope.checking = false; //Turn off loading symbol
            return;
        };

        //Show next Section
        currentSection.failedValidation = false;
        currentSection.completed = true;
        currentSection.isOpen = false;
        nextSection.isOpen = true;
        $scope.stage = nextSection.sectionName;
        $scope.wizardPosition = nextSection.wizardPosition;

//	  $window.scrollTo(0, 250);
        $('html, body').animate({scrollTop: $("#visaAusETAForm").offset().top}, 200);
        $scope.checking = false; //Turn off loading symbol
    }	// end of nextSection function.

    $scope.AmISubmitable = function(){
        // TODO: hardcoded to 3 sections, so recode to pick up which sections have mandatory set to true.
        return $scope.sections[0].completed && $scope.sections[1].completed && $scope.sections[2].completed && $scope.NoHardError && $scope.NotYetSubmitted;
    }

    $scope.CardIssueNoRequired = function(){
        // function to determine whether to display the Issue No field when Switch has been selected as the Card Type.
        return $scope.CardType == 'SW';
    }

    $scope.CardNoChange = function(){
        // After an invalid Card No has been received, when any of the Credit Card fields are changed remove the error message.
        $scope.forms.visaAusETASection3.CARDNO.$setValidity( 'validcardno', true);
        $scope.invalidCardDetails = false;
    }

    $scope.SuperfactsFailInvalidCardNo = function(){
        // Take action if Superfacts tells us some of the Card details are wrong.
        $scope.NoHardError = true;				// We've NOT hit a Hard Error and so re-enable the Submit Button.
        $scope.SuperfactsSuccess = false;			// just to make sure.
        $scope.SuperfactsError = false;			// just to make sure.
        $scope.sectionMakeIncomplete( 2 )
        $scope.wizardPosition = 2;
        $scope.sections[2].isOpen = true;
        $scope.sections[2].focus = true;

        $scope.forms.visaAusETASection3.CARDNO.$dirty = true;
//	  $scope.forms.visaAusETASection3.CARDNO.$setValidity( 'validcardno', false);	// don't know this is the case, as might be wrong date or wrong CSC.
        $scope.invalidCardDetails = true;
        $scope.sections[2].failedValidation = true;
    }
    $scope.SuperfactsFail = function( err, response ){
        // A Hard Error has been returned from Superfacts, so set-up things so that Submit can't be used again.
        $scope.NoHardError = false;							// Disable the Submit Button.
        $scope.SuperfactsError = true;
        $scope.SuperfactsSuccess = false;		// just to make sure.
        $scope.visaAusETA.SuperfactsBookingRef = response.data.bookno;
        if( $scope[ err ] != undefined ){					// See if we have a predefined error msg, and if so display it.
            $scope.SuperfactsErrorText = '<span style="display:hidden;">' + $scope[ err ] + ' ref=' + response.data.bookno + '</span>';
        } else {
            if( response.data ){
                $scope.msg = response.data;
                if( response.data.data )	{
                    $scope.msg = response.data.data;
                    $scope.visaAusETA.SuperfactsBookingRef = response.data.bookno;
                    if( response.data.data.msg )	{
                        $scope.msg = response.data.data.msg;
                        $scope.visaAusETA.SuperfactsBookingRef = response.data.data.bookno;
                    }
                }
            }
            $scope.SuperfactsErrorText = $scope.msg;
        }
        $scope.sendEmailError( $scope.SuperfactsErrorText );
    }

    $scope.processSuperfactsSuccess = function( response ) {
//      $scope.visaAusETA.error = response.error;
        var etaStatus = "";
        if( response.data ){
            if( response.data.data ){
                $scope.visaAusETA.SuperfactsBookingRef = response.data.data.bookno;
                // etaStatus = response.data.data.status;
            };
            if( response.data.status ){
                etaStatus = response.data.status;
            };
        }
        switch( etaStatus ){
            case 'etaapprove':
                $scope.SuperfactsSuccess = true;
                $scope.SuperfactsError = false;			// just to make sure.
                $scope.NotYetSubmitted = false;			// set flag that ETA has been submitted and so disable Submit button.
                var approvaldata = "";
                if( response.data.data.approve ) {
                    // pass the Aus ETA data back from GAL onto the Email routine for including in the email body.
                    approvaldata = response.data.data.approve;
                }
                approvaldata = $scope.formatResults( approvaldata );
                $scope.sendEmailClient( approvaldata );

                break;
            case 'etacardreenter':
                // etacardree
                $scope.SuperfactsFailInvalidCardNo();
                // not terminal, so don't set SuperfactsSuccess or SuperfactsError.
                break;
            case 'etacallerror':
                // etacallerr
                $scope.SuperfactsFail( etaStatus, response );
                $scope.SuperfactsSuccess = false;		// just to make sure.
                $scope.SuperfactsError = true;
                break;
            case 'etaduplicate':
                // etaduplica
                $scope.SuperfactsFail( etaStatus, response );
                $scope.SuperfactsSuccess = false;		// just to make sure.
                $scope.SuperfactsError = true;
                break;
            default:
                $scope.SuperfactsFail( "errunkno", response );
                $scope.SuperfactsSuccess = false;			// TODO: ???
                $scope.SuperfactsError = true;				// TODO: ???
//	  	$scope.SuperfactsErrorText = "<span>" + response + "</span>";	// TODO: ???
//	  $scope.visaAusETA.headers = headers;						// TODO: commented out for testing.
//	  $scope.visaAusETA.config = config;						// TODO: commented out for testing.
                break;
        }
        $scope.checking = false; //Switch off loading symbol.
        if( $scope.msg == "" ){
            var msgstr = response.msg;
            if( msgstr != "" ){
                $scope.msg = msgstr;
            } else {
                $scope.msg = etaStatus + "!";
            }
        }
    }
    $scope.processSuperfactsError = function( response ) {
        $scope.checking = false;
        $scope.NoHardError = false;							// Disable the Submit Button.
        $scope.visaAusETA.error = 'true';
        $scope.msg = response.statusMsg + " " + response.status + " " + response.data;
        $scope.SuperfactsSuccess = false;			// TODO: ???
        $scope.SuperfactsError = true;				// TODO: ???
        $scope.SuperfactsErrorText = "<span>" + $scope.msg + "</span>";
    }

    if( $scope.siteSpecific.debug ) {
//	  fillTestValues(0);
//	  /*
        fillTestValues(1);
        $scope.sections[0].completed = true;
        $scope.sections[0].isOpen = false;
        $scope.sections[1].isOpen = true;
        $scope.stage = $scope.sections[1].sectionName;
        $scope.wizardPosition = $scope.sections[1].wizardPosition;
//	   */
        /*
         fillTestValues(1);
         fillTestValues(2);
         $scope.sections[0].completed = true;
         $scope.sections[1].completed = true;
         $scope.sections[0].isOpen = false;
         $scope.sections[1].isOpen = false;
         $scope.sections[2].isOpen = true;
         $scope.stage = $scope.sections[2].sectionName;
         $scope.wizardPosition = $scope.sections[2].wizardPosition;
         */
        /*
         fillTestValues(1);
         fillTestValues(2);
         fillTestValues(3);
         $scope.sections[0].completed = true;
         $scope.sections[1].completed = true;
         $scope.sections[2].completed = true;
         $scope.sections[0].isOpen = false;
         $scope.sections[1].isOpen = false;
         $scope.sections[2].isOpen = false;
         $scope.sections[3].isOpen = true;
         $scope.stage = $scope.sections[3].sectionName;
         $scope.wizardPosition = $scope.sections[3].wizardPosition;
         */
    };


    $scope.creditCardStatus = function(isValid,cardNumber,cardObject){
        if(isValid===false){
            $scope.invalidCardDetails = true;
            $scope.forms.visaAusETASection3.CARDNO.$dirty = true;
            $scope.forms.visaAusETASection3.CARDNO.$valid = false;
//    	  $scope.forms.visaAusETASection3.CARDNO.$setValidity( 'validcardno', false);
            $scope.$apply(function(){ $scope.forms.visaAusETASection3.CARDNO.$setValidity("validcardno", false); })
            return;
        }else{
            $scope.invalidCardDetails = false;
            $scope.forms.visaAusETASection3.CARDNO.$valid = true;
            $scope.visaAusETA.CARDNO = replaceSubString( cardNumber, " ", "" );
            $scope.$apply(function(){ $scope.forms.visaAusETASection3.CARDNO.$setValidity( 'validcardno', true) });
        }
        var cardName=cardObject.type;
        if(cardName!=undefined){
            //Based on cardname set cardtype - we need this to post to the Bean
            //If the card type is not one of these values (and IE cannot have amex) then return false
            //Disable issue number if not paying by swicth
            if(cardName=='amex'){
                $scope.CardType='AX';
            }
            if(cardName=='visa' || cardName=='test'){
                $scope.CardType='BC';
            }
            if(cardName=='mastercard'){
                $scope.CardType='XS';
            }
            if(cardName=='maestro'){
                $scope.CardType='SW';
            }
            if(cardName=='dinersclub'){
                $scope.CardType='DC';
            }
            if(cardName=='switch'){
                $scope.CardType='SW';
            }
            $scope.visaAusETA.CARDTYPE		= $scope.CardType;
        }
    }



// Submit - Do HTTP Post to Superfacts.
    $scope.submitRequest = function() {
        //If form is not yet valid then don't submit.
        // if (!$scope.forms.visaAusETASection1.$valid || !$scope.forms.visaAusETASection2.$valid )
        if( !$scope.AmISubmitable() )   return false;

//	  TODO: validate data to be Posted, so that even if "required" parms removed by user, then still the data will be valid.

        $scope.NoHardError = false;		// Set Hard Error flag so that the Submit Button will never be enabled again.
        // set up some more visaAusETA values from the entered data before we submit them all.
        $scope.checking = true; //Used to display the loading symbol
        $scope.visaAusETA.BROWSER = navigator.appVersion;
        $scope.visaAusETA.REMOTE_ADDR = siteVar.ipRemoteAddress;
        $scope.visaAusETA.REFERER = $scope.siteSpecific.referer;

        // Superfacts expects dates to be in the format ddMMMyyyy
        $scope.visaAusETA.DOB 			= pad( $scope.DOB.dd, 2 ) + $scope.DOB.mm + $scope.DOB.yy;
        $scope.visaAusETA.ISSUEDATE 		= pad( $scope.PassportIssued.dd, 2 ) + $scope.PassportIssued.mm + $scope.PassportIssued.yy;
        $scope.visaAusETA.EXPIRYDATE 		= pad( $scope.PassportExpiry.dd, 2 ) + $scope.PassportExpiry.mm + $scope.PassportExpiry.yy;

        $scope.visaAusETA.COUNTRY1 		= $scope.PhoneDaytime.Country;
        $scope.visaAusETA.AREA1 			= $scope.PhoneDaytime.Area;
        $scope.visaAusETA.PHONE1 			= $scope.PhoneDaytime.Phone;
        $scope.visaAusETA.COUNTRY2 		= $scope.PhoneAlternative.Country;
        $scope.visaAusETA.AREA2 			= $scope.PhoneAlternative.Area;
        $scope.visaAusETA.PHONE2 			= $scope.PhoneAlternative.Phone;
        $scope.visaAusETA.MOBILE1 		= $scope.PhoneMobile.Part1;
        $scope.visaAusETA.MOBILE2 		= $scope.PhoneMobile.Part2;

        $scope.visaAusETA.ALTCITIZENSHIPYESNO = $scope.visaAusETA.AltCitizenShip1 == null && $scope.visaAusETA.AltCitizenShip1 == null ? "NO":"YES";
        $scope.visaAusETA.TFBOOKING 		= $scope.TFBooking   // send TFBooking flag so it can be logged too along with TFBookingNo if entered.

        $scope.visaAusETA.CARDEXPMO 		= $scope.CardExpiry.mm;
        $scope.visaAusETA.CARDEXPYR 		= $scope.CardExpiry.yy;
//	  $scope.visaAusETA.CARDNO			= replaceSubString( $scope.CardNo, " ", "" );		// Set in creditCardStatus()
//	  $scope.visaAusETA.CARDTYPE		= $scope.CardType;									// Set in creditCardStatus()

        //Post the request to Dynamic Xport, via proxy on Bromo, and expect some JSON back.
        $http({
            url: $scope.siteSpecific.apiURL + '/visa/auseta/payment/',
            method: "POST", //Must be POST for security
            data: $scope.visaAusETA, 				//We just pass the whole visAusETA Object
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            // Post $scope.visaAusETA data as JSON to API Server to Post it onto Superfacts.
        }).then(
            function( response ) {
                $scope.processSuperfactsSuccess( response ) },
            function( response ) {
                $scope.processSuperfactsError( response ) }
        );
    }		// end of submitRequest function.

    // Open Modal Dialog showing CSC What's this, template defined on the Form.
    $scope.openCSC = function () {
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'myModalContent.html',
            size: 'sm'
        });
    };

    //Depending on the Referer, set the Symbol and the name & telephone number & domain.
    function setSiteSpecific() {
        // TODO: Convert to use siteVar variables.
        var hostname = window.location.hostname;
        var elements = hostname.toLowerCase().split(".");
        if (elements[elements.length - 2] == 'test') {
            var debug = true;
        } else {
            var debug = false;
        }

        var apiURL = "https://secure.trailfinders";
        var apiPort = "";
//      if( siteVar.secureServer == "" ) apiURL = "http://secure.trailfinders";
        if( debug ) {
            apiURL = "http://bintan.trailfinders";
            apiPort = ":8002";
        }

        if (elements[elements.length - 1] == 'ie') {
            return ({
                'option': "ETAIE",
                'domain': 'ie',
                'referer': 'IE',
                'travelcentre': 'Ireland',
                'apiURL': apiURL + ".ie" + apiPort + "/api",
                'emailfrom':'visas-ireland@trailfinders.com',
                'symbol': '\u20AC',
                'name': 'EUR',
                'telephone': siteVar.phoneLookup.phoneNumber[0],
                'debug': debug
            });
        } else {
            return ({
                'option': "ETAUK",
                'domain': 'com',
                'referer': 'UK',
                'travelcentre': 'UK',
                'apiURL': apiURL + ".com" + apiPort + "/api",
                'emailfrom':'visas@trailfinders.com',
                'symbol': '\u00A3',
                'name': 'GBP',
                'telephone': siteVar.phoneLookup.phoneNumber[0],
                'debug': debug
            });
        }
    }	// end of function setSiteSpecific()

    $scope.getUKIE = function(){
        var vals = ['UK','IE'];
        if( $scope.siteSpecific.referer == "IE" ){
            vals = ['IE','UK'];
        }
        return vals
    }

    $scope.sendEmailClient = function( etadata  ) {
        //Post an email to API server to send to user.
        var email = {};
        email.subject 			= "Australian ETA Visa Application via Trailfinders";
        email.send_to			= $scope.visaAusETA.Email;
        email.reply_to 			= $scope.siteSpecific.emailfrom;
        email.bcc		 		= "Jerry.Shelley@Trailfinders.com";
        email.email_body 		=
            '<span style="font-family:Arial;">'
            +"<strong>Australian ETA Visa Application</strong>"
            +"<br />"
            +"<br />Thank you for submitting your Visa Application with Trailfinders."
            +"<br />"
            +"<br />Your Booking Reference is <strong>" + $scope.visaAusETA.SuperfactsBookingRef + "</strong>"
            +"<br />"
            + etadata.replace(/,/g, ",<br/>")
            +"<br />"
            +"<br />If any of the information you have provided is incorrect please contact us on " + $scope.siteSpecific.telephone + " and we will be happy to rectify that for you."
            +"<br />"
            +"<br />Thank you.<br />Trailfinders Ltd."
            +"</span>";
        email.originator_system = "visaAusETA";
        $http({
            url: $scope.siteSpecific.apiURL + "/email/",
            method: "POST",
            data: email,		    	// Post $scope.email object as JSON to API server to send email.
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'cache-control': 'no-cache'
            }
        }).then(
            function( response ) {
//    				alert( "resp=" + response )
            },
            function( response ) {
//    				alert( "resp=" + response )
                $scope.msg = response.errorMsg;
//    				$scope.msg = response.response;		// TODO: more likely this than .errorMsg?
            }
        );
    }    // end of sendEmailClient function.
    $scope.sendEmailError = function( etadata  ) {
        //Post an email to API server to send to developer.
        var email = {};
        email.subject 			= "Australian ETA Visa Application Error";
        email.send_to			= "Jerry.Shelley@Trailfinders.com"; 		// "Intranet@Trailfinders.com";
        email.email_body 		=
            '<span style="font-family:Arial;">'
            +"<strong>Australian ETA Visa Application Error </strong>"
            +"<br />"
            +"<br />Booking Reference is <strong>" + $scope.visaAusETA.SuperfactsBookingRef + "</strong>"
            +"<br />"
            + etadata
            +"<br />"
            +"</span>";
        email.originator_system = "visaAusETA";
        $http({
            url: $scope.siteSpecific.apiURL + "/email/",
            method: "POST",
            data: email,		    	// Post $scope.email object as JSON to API server to send email.
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'cache-control': 'no-cache'
            }
        }).then(
            function( response ) {},
            function( response ) {$scope.msg = response.errorMsg;}
        );
    }    // end of sendEmailError function.

    // Add highlighting class to the radio-checkbox-group containing div for Radio buttons, to mimic the highlighting of normal input fields.
    $scope.highlightFocus = function( ele ) {
        $( '#' + ele + '-RADIO' ).addClass( "radio-checkbox-group-focus" );
    };
    // Remove highlighting class from the radio-checkbox-group containing div for Radio buttons, to mimic the highlighting of normal input fields.
    $scope.highlightBlur = function( ele ) {
        $( '#' + ele + '-RADIO' ).removeClass( "radio-checkbox-group-focus" );
    };

    $scope.formatResults = function( res ){
        /* Reformat approval data results from SuperFacts ( ie GAL )*/
        var pos = -1;
        var tmp = "";
        /*  	example data =
         * 			"ETA APPROVAL 19JUN16/2045,FAMILY NAME surname AUSTRALIAN GOVT,GIVEN NAMES JOHN ARTHUR ,PASSPORT passpostnum GBR EXPIRY DATE 23MAY2026," +
         * 			"DATE OF BIRTH 01MAY1961 SEX M COB GBR,TYPE OF TRAVEL T TOURIST ,ENTRY STATUS UD/601 ETA ,AUTHORITY TO ENTER AUSTRALIA UNTIL 19JUN2017 ," +
         *			"PERIOD OF STAY 03 MTHS ,MULTIPLE ENTRY ,NO WORK - BUSINESS VISITOR ACTIVITY ONLY"
         */
        var resarr = res.split( "," );
        pos = resarr[1].indexOf( "AUSTRALIAN GOVT" );
        if( pos > -1 ){
            resarr[1] = resarr[1].replace( "AUSTRALIAN GOVT", "" );
            resarr.splice(1,0, "AUSTRALIAN GOVT");
        };
        pos = resarr[4].indexOf( "EXPIRY DATE" );
        if( pos > -1 ){
            tmp = resarr[4].substring( pos );
            resarr.splice(5,0, tmp);
            resarr[4] = resarr[4].replace( tmp, "" );
        };
        pos = resarr[6].indexOf( " SEX " );
        if( pos > -1 ){
            tmp = resarr[6].substring( pos + 1 );
            resarr.splice(7,0, tmp);
            resarr[6] = resarr[6].replace( " " + tmp, "" );
        };
        pos = resarr[7].indexOf( " COB " );
        if( pos > -1 ){
            tmp = resarr[7].substring( pos + 1 );
            resarr.splice(8,0, tmp);
            resarr[7] = resarr[7].replace( " " + tmp, "" );
        };
        tmp = resarr.join();
        return tmp;
    };

    // General utility functions.
    function gup(name) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regexS = "[\\?&]" + name + "=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.href);
        if (results == null) return "";
        else return results[1];
    }
    function getPath(){
        var path = window.location.pathname;
        var idx = path.lastIndexOf( "/" );
        path = path.substring(0, idx );
        return path;
    }
    function replaceSubString( str, from, to ){
        return str.split( from ).join( to );
    }

// end of General utility functions.


// ***********************************************************
// From here on, down to the end of this appController, are functions and settings for TESTING purposes.
// ***********************************************************
    $scope.fillTestValues = function( sectNum ){
        // function for use by a button with an ng-click, calls this scope's fillTestValues() function.
        fillTestValues( sectNum );
    }
    function fillTestValues( sectNum ){
        if( sectNum == undefined ) sectNum = 99;

        if( sectNum == 1 || sectNum > 3 ){
            $scope.visaAusETA.title = "Mrs";
            $scope.visaAusETA.GivenName = "Tester";
            $scope.visaAusETA.FamilyName = "Testing";

            $scope.visaAusETA.KnownBy = "N";
            $scope.visaAusETA.Conviction = "N";

            $scope.DOB.dd = "2";
            $scope.DOB.mm = "FEB";
            $scope.DOB.yy = "2004";
            $scope.visaAusETA.Sex = "F";
            $scope.visaAusETA.Nationality = "UK - British Citizen";
            $scope.visaAusETA.COB = "GBR United Kingdom";
            $scope.visaAusETA.PassportNo = "1234567890";
            $scope.PassportIssued.dd = "5";
            $scope.PassportIssued.mm = "SEP";
            $scope.PassportIssued.yy = "2007";
            $scope.PassportExpiry.dd = "5";
            $scope.PassportExpiry.mm = "SEP";
            $scope.PassportExpiry.yy = "2017";
            $scope.visaAusETA.IssuingState = "GBR United Kingdom";
            $scope.visaAusETA.PlaceOfIssue = "Newport";
            $scope.visaAusETA.TypeOfTravel = "T";
//  		$scope.visaAusETA.AltCitizenShip1 = "ALB Albania";
//  		$scope.visaAusETA.AltCitizenShip2 = "DZA Algeria";

            if( sectNum == 1 ) return;
        }

        if( sectNum == 2 || sectNum > 3 ){
            if( $scope.siteSpecific.referer == "IE" ){
                $scope.PhoneDaytime.Country 	= "353";
                $scope.PhoneAlternative.Country 	= "44";
            } else {
                $scope.PhoneDaytime.Country 	= "44";
                $scope.PhoneAlternative.Country 	= "353";
            }
            $scope.PhoneDaytime.Area 		= "01234";
            $scope.PhoneDaytime.Phone 		= "567 890";
            $scope.PhoneAlternative.Area 	= "09876";
            $scope.PhoneAlternative.Phone	= "543 210";

            $scope.PhoneMobile.Part1 = "44";
            $scope.PhoneMobile.Part2 = "07 777 777 777";
            $scope.visaAusETA.Email = "jerry.shelley@trailfinders.com";

            $( '#PARTIAL' ).val( "w8 6FT" )
            // .removeClass("ng-pristine ng-untouched ng-invalid ng-invalid-required" ).addClass( "ng-dirty ng-valid-parse ng-valid ng-valid-required ng-touched");
            $scope.visaAusETA.Address1 = "Trailfinders Ltd";
            $scope.visaAusETA.Address2 = "42-50 EARLS COURT ROAD";
            $scope.visaAusETA.Address3 = "LONDON";
            $scope.visaAusETA.POSTCODE = "w8 6ft";
            $scope.addressHasBeenSelected = true;

            if( sectNum == 2 ) return;
        }

        if( sectNum == 3 || sectNum > 3 ){
            $scope.visaAusETA.CardType = "SW";
//    		$scope.CardNo = "4242424242424201";
            $scope.CardExpiry.mm = "02";
            $scope.CardExpiry.yy = "2017";
            $scope.visaAusETA.CardIssueNo = "12";
            $scope.visaAusETA.CardCheckNo = "234";
            $scope.visaAusETA.CardHolderName = "Mx TESTY McTester";
            if( sectNum == 3 ) return;
        }
    }			// end of fillTestValues.



    // simulateSuperfactsSucceed() - called from simulation Succeed button on Form.
    $scope.simulateSuperfactsSucceed = function(){
        // Simulated Credit Card request to Superfacts succeeded, so reset all flags to good just to make sure.
        // (Only used from the Simulate buttons on the Form when testing)
        var response = {
            "statusText": "200 is good",
            "status": 200,
            "data":{
                "status":"etaapprove",
                "data":{
                    "fullname": "Fred Bloggs",
                    "address1":"1 Address Line",
                    "address2":"Address Live 2,)",
                    "address3":"address Line 3",
                    "address4":"address line 4)",
                    "postcode":"postycode",
                    "name":"card name)",
                    "bookno":"JPS999",
                    "approve":
                    "ETA APPROVAL 19JUN16/2045,FAMILY NAME surname AUSTRALIAN GOVT,GIVEN NAMES JOHN ARTHUR ,PASSPORT passpostnum GBR EXPIRY DATE 23MAY2026," +
                    "DATE OF BIRTH 01MAY1961 SEX M COB GBR,TYPE OF TRAVEL T TOURIST ,ENTRY STATUS UD/601 ETA ,AUTHORITY TO ENTER AUSTRALIA UNTIL 19JUN2017 ," +
                    "PERIOD OF STAY 03 MTHS ,MULTIPLE ENTRY ,NO WORK - BUSINESS VISITOR ACTIVITY ONLY",
                    "msg": "Yippee"
                }
            }
        };
        $scope.processSuperfactsSuccess( response );
    }

    // Used in simulation Auth Error button on Form
    // to pretend return data from Superfacts for testing
    $scope.simulate_etacallerror1 = {
        "status":200,
        "data":{
            "status":"etacallerror",
            "bookno":"ZYX987",
            "msg":"Error authorising Credit Card payment;"
        }
    };
    // Used in simulation Call Error button on Form
    // Pretend return data from Superfacts for testing
    $scope.simulate_etacallerror2 = {
        "status":200,
        "data":{
            "status":"etacallerror",
            "bookno":"ZYX998",
            "msg":"Error processing ETA request;"
        }
    };
    // Pretend return data from Superfacts for testing
    $scope.simulate_etaduplicateerror = {
        "status":200,
        "data":{
            "status":"etaduplicate",
            "bookno":"ZYX997",
            "Passport": "dl4v(PASSPORTNO)",
            "Name": "dl4v(fullname)",
            "msg":"Error processing ETA request. Your card has <b>NOT</b> been charged."
        }
    };
    // Pretend return data from Superfacts for testing
    $scope.simulate_etaunknownerror = {
        "status": 200,
        "data":{
            "status":'etasomethingelsewrong',
            "bookno":"ZYX996",
            "msg": "Your card has <b>NOT</b> been charged."
        }
    };
    // Test Email function
    $scope.simulateSendEmail = function(){
        $scope.visaAusETA.SuperfactsBookingRef = "XYZ987";
        $scope.sendEmailClient();
    }

    $scope.loading = false;

}]);
// End of app.controller("formController", ...{
// ***********************************************************




//Extra functions to make life easier in Angular.
focus.$inject=["$timeout"];
app.directive( 'focus',  function($timeout, $window) {
//	Plagiarised from http://www.marushkevych.com/2014/05/21/angular-focus-on-input/
//	We add a boolean @ isolate scope property to our directive to communicate when to focus.
//	We need to wrap focus() with timeout() in order to let browser handle the event that was supposed to trigger the focus.
    return {
        scope: {
            focus: '@'
        },
        link: function(scope, element) {
            function doFocus() {
                $timeout(function() {
                    if( element[0].id == "focusCARDNO"){
                        // can't have 2 isolated scope directives on the CardNo, so focus directive placed on preceding DIV !
                        element[0].childNodes[1].focus();
                        $window.scrollTo( 0, 100 );
                    } else {
                        element[0].focus();
                        if( element[0].name != "TFBOOKINGNO" ) {
                            $window.scrollTo( 0, 100 );
                        };
                    }
                });
            }

            if (scope.focus != null) {
                // focus unless attribute evaluates to 'false'
                if (scope.focus !== 'false') {
                    doFocus();
                }

                // focus if attribute value changes to 'true'
                scope.$watch('focus', function(value) {
                    if (value === 'true') {
                        doFocus();
                    }
                });
            }
            else {
                // if attribute value is not provided - always focus
                doFocus();
            }
        } // end of link: function
    }
})
app.directive('validateEmail', function() {
//	var EMAIL_REGEXP = /^[_a-z0-9]+(\.[_a-z0-9]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,6})$/;
    var EMAIL_REGEXP = /^[_a-zA-Z0-9]+(\.[_a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(\.[a-zA-Z]{2,6})$/;

    return {
        require: 'ngModel',
        restrict: '',
        link: function(scope, elm, attrs, ctrl) {
            // only apply the validator if ngModel is present and Angular has added the email validator
            if (ctrl && ctrl.$validators.email) {

                // this will overwrite the default Angular email validator
                ctrl.$validators.email = function(modelValue) {
                    return ctrl.$isEmpty(modelValue) || EMAIL_REGEXP.test(modelValue);
                };
            }
        }
    };
});