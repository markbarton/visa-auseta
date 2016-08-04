
var Trailfinders=Trailfinders || {};

Trailfinders.AutoAddressUK=function ($rootScope) {
    return {
        scope: {ctrlFn: '&'},
        link: link
    };

    function link($scope, $element, att) {

        var options = {
            elements: {
                input: $element.get(0)
            },
            useSpinner: true
        }

       var address = new ContactDataServices.address(options);
        address.events.on("post-formatting-search", function (data) {

            $scope.$apply(function () {
                console.log(data);
                $scope.passedAddress = {}
                $scope.passedAddress.postcode = ""
                var tmp = "";
                if (data.address) {
                $.each(data.address, function (index, value) {
                   if(value.addressLine1){
                        tmp += value.addressLine1 + ","
                    }
                    if(value.addressLine2){
                        tmp += value.addressLine2 + ","
                    }
                    if(value.addressLine3){
                        tmp += value.addressLine3 + ","
                    }
                    if(value.locality){
                        tmp += value.locality + ","
                    }
                    if(value.postalCode){
                        $scope.passedAddress.postcode = value.postalCode;
                    }
                   });
                }
                $scope.passedAddress.selectedAddress = tmp.replace(/^\s+|\s+$/g, '');
       //     console.log($scope.passedAddress)
                $rootScope.$broadcast('ukaddress', $scope.passedAddress);
            //    $scope.ctrlFn({address: $scope.passedAddress})
                $scope.addresslookup = null;
            });

        });
    }
};