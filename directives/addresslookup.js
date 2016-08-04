/**
 A custom Directive to do a UK address lookup based on the selected postcode
 If multiple address are returned then allow a single selection

 * This directive makes use of the CSS based throbber and therefore the throbber stylesheet should be included in the parent page
 * This directive makes use of the validPostcode directive.

 Example usage
 <address-lookup ctrl-fn="addressSelected(address)" ></address-lookup>
 The function that needs to be called when an address is selected is passed in the directive - ctrl-fn in this case is addressSelected(address)

 The restrict option is typically set to one or more of:
 'A' - only matches attribute name
 'E' - only matches element name
 'C' - only matches class name
 'M' - only matches comment
 */
var Trailfinders = Trailfinders || {};

Trailfinders.AddressLookup = function ($http ) {
    return {
        restrict: 'E',
        templateUrl: 'addressLookup-template',
        replace: true,
        scope: { ctrlFn: '&',submitted:'=',manualAddress:'='},
        link: link
    }

    function link(scope, element, attributes) {
        //Helper function to determine if the form has been attempted to be submitted
        scope.interacted = function(field) {
            if(field){
                return scope.submitted || field.$dirty;
            }else{
                return scope.submitted
            }
        };

        //Array to hold list of address returned from service
        scope.addresslookup = null;
        scope.selectedAddress={};
        //address object which is passed back to the calling function
        scope.address = {};
        scope.predicate='-address';

        scope.$watchCollection("selectedAddress",function(newValue,oldValue){
            // Ignore initial setup.
            if ( newValue === oldValue ) {
                return;
            }
            if(scope.selectedAddress!=null || scope.selectedAddress!=""){
                scope.addressSelected();
            }
        })

        //When the address is selected from the combo box this function is called
        scope.addressSelected = function ( addr ) {
//        	var whichLookup = "UK";		// UK and Scot websites.
//            if( scope.$parent.siteSpecific.referer == "IE" ) whichLookup = "IE"
//            if( scope.$parent.OutsideAddress.reside != whichLookup ) {
//            	whichLookup = scope.$parent.OutsideAddress.reside;
//            }
            scope.passedAddress = {}
            if( scope.$parent.whichAddressLookup == "UK") {
                scope.passedAddress.selectedAddress = scope.selectedAddress.UK;
                scope.passedAddress.postcode = scope.address.partial;
            } else {
                /* {eidcode: "D02FH72", postcode:"IRELAND", selectedAddress:"TRAILFINDERS,4/5 Dawson St, DUBLIN 2"} */

                scope.passedAddress.selectedAddress = addr.selectedAddress.replace(/^\s+|\s+$/g, '');
                scope.passedAddress.postcode = addr.eircode;
            }
            //Call passed in function passing address information
            scope.ctrlFn({address: scope.passedAddress})
            scope.addresslookup=null;
        }


        //Main function for calling an external service (via a proxy agent) to get address information based on the postcode
        scope.lookupAddress = function () {
            scope.checking = true;
//            var whichLookup = "UK";		// UK and Scot websites.
//            if( scope.$parent.siteSpecific.referer == "IE" ) whichLookup = "IE"
//            if( scope.$parent.OutsideAddress.reside != whichLookup ) {
//            	whichLookup = scope.$parent.OutsideAddress.reside;
//            }
            if( scope.$parent.whichAddressLookup == "UK") {
                scope.doLookupUK();
            } else {
                scope.doLookupIE();
            }
        }
        scope.doLookupUK = function () {
            $http({
                method: 'GET',
                url: 'https://secure.trailfinders.com/api' + '/addresslookup/'+scope.address.partial+','  //Node Server
            }).then(
                function( response ) {
                    scope.processLookupUKSuccess( response ) },
                function( response ) {
                    scope.processLookupUKError( response ) }
            );
        };       // end of doLookupUK function.

        scope.processLookupUKSuccess = function( response ){
//        	success(function (data, status) {
            scope.addresslookup = {};
            //We expect to get a JSON object now
            scope.address.error = '';
            //Check for no matches
            var data = response.data;
            if (data.Address.Type == 'None') {
                scope.address.error = 'No Matches';
                scope.checking = false
                return;
            }

            //We need to check for a single or multi address as the returned data looks different
            if (data.Address.Type == 'Single') {
                //Implode properties
                var tmpAddress = data.Address.Result[0].address1 + "," + data.Address.Result[0].address2 + "," + data.Address.Result[0].address3;
                if (data.Address.Result[0].address4 != undefined) {
                    tmpAddress += "," + data.Address.Result[0].address4;
                }
                if (data.Address.Result[0].address5 != undefined) {
                    tmpAddress += "," + data.Address.Result[0].address5;
                }
                scope.addresslookup[0]=({'address':tmpAddress,'selected':false})
            } else {
                //We have multiple matches
                var tmpArray = data.Address.Result;
                //Sort Addresses
                var tmpSortedArray=[];

                for (var key in tmpArray) {
                    tmpSortedArray.push(tmpArray[key]['PickText']);
                }
                if(tmpSortedArray.length>0){
                    tmpSortedArray.sort();

                    for (var key in tmpSortedArray) {
                        scope.addresslookup[key]=({'address':tmpSortedArray[key],'selected':false})
                    }
                }
            }
            scope.checking = false //Turn off Loading indicator
        };  // end of processLookupUKSuccess function.

        scope.processLookupUKError = function( response ){
//	       	error(function (data, status) {
            if( response.data ){
                scope.address.error = response.data.message;
            } else {
                scope.address.error = "Error accessing Post Code Lookup API server.";
            }
//        		scope.addresslookup[0]=({'address':"Error",'selected':true});
            scope.checking = false
        };	// end of processLookupUKError function.


        scope.doLookupIE = function(){
            // ToDo: convert to .then callback functions like UK.
            $http({
                method: 'POST',
                url: 'https://secure.trailfinders.com/api' + '/address/ie',  //Node Server		should it be .ie or .com?!?
                data:{"address":scope.address.partial}
            }).
            success(function (data, status) {
                scope.addresslookup = {};
                //We expect to get a JSON object now
                scope.address.error = '';
                //Check for no matches
                console.log(data)
                if(!data.Results.Items){
                    scope.address.error = 'No Matches';
                    scope.checking = false
                    return;
                }
                scope.addresslookup=data.Results.Items
                scope.checking = false
            }).
            error(function (data, status) {
                scope.address.error = data.message;
                scope.checking = false
            })
        }		// end of doLookupIE function.

    };		// end of link function.
}