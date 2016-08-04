/**
 * Created by markb on 03/08/2016.
 */
angular.module('directives', [])

    .directive('validUkPostcode', Trailfinders.ValidUKPostcode)
    .directive('addressLookup', Trailfinders.AddressLookup)
    .directive('autoAddressIe', Trailfinders.AutoAddressIE)
    .directive('autoAddressUk', Trailfinders.AutoAddressUK)
