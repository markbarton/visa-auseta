/**
 * Created by Jerry on 27/05/2014.
 * This simple validation directive is used to check that the user has entered a valid UK Postcode
 *
 * Sample Usage
 *
 * <input type="text" id="Postcode" name="Postcode" ng-model="address.Postcode" placeholder="Enter your Postcode" required valid-uk-postcode/>
 */
var Trailfinders = Trailfinders || {};

Trailfinders.ValidUKPostcode = function() {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, elm, attrs, ctrl) {

            ctrl.$parsers.unshift(function(viewValue) {

                var postcodeRegEx = /\b([A-PR-UWYZa-pr-uwyz]([0-9]{1,2}|([A-HK-Ya-hk-y][0-9]|[A-HK-Ya-hk-y][0-9]([0-9]|[ABEHMNPRV-Yabehmnprv-y]))|[0-9][A-HJKS-UWa-hjks-uw])\ {0,1}[0-9][ABD-HJLNP-UW-Zabd-hjlnp-uw-z]{2}|([Gg][Ii][Rr]\ 0[Aa][Aa])|([Ss][Aa][Nn]\ {0,1}[Tt][Aa]1)|([Bb][Ff][Pp][Oo]\ {0,1}([Cc]\/[Oo]\ )?[0-9]{1,4})|(([Aa][Ss][Cc][Nn]|[Bb][Bb][Nn][Dd]|[BFSbfs][Ii][Qq][Qq]|[Pp][Cc][Rr][Nn]|[Ss][Tt][Hh][Ll]|[Tt][Dd][Cc][Uu]|[Tt][Kk][Cc][Aa])\ {0,1}1[Zz][Zz]))\b/;
                ctrl.$setValidity('validpostcode', postcodeRegEx.test(viewValue.toUpperCase()));
                return viewValue;
            });
        }
    };

}