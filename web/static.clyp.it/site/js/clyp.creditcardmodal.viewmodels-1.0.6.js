var CreditCardAlertBoxViewModel = function() {
    var self = this;
    self.color = ko.observable("red");
    self.visible = ko.observable(false);
    self.message = ko.observable("There was an error");
};

var CreditCardValidator = function(validNumber, validExpiration, validCVV, validZip) {
    var self = this;
    self.buildErrorMessage = function() {
        var invalidFields = [];
        if (!validNumber) {
            invalidFields.push("card number");
        }
        if (!validCVV) {
            invalidFields.push("CVV (the secure code on the back)");
        }
        if (!validExpiration) {
            invalidFields.push("expiration date");
        }
        if (!validZip) {
            invalidFields.push("billing zip code");
        }

        if (invalidFields.length === 0) {
            return null;
        }
        if (invalidFields.length === 1) {
            return "Invalid " + invalidFields[0] + ".";
        }
        if (invalidFields.length === 2) {
            return "Invalid " + invalidFields[0] + " and " + invalidFields[1] + ".";
        }
        if (invalidFields.length > 2) {
            return "Invalid credit card information.";
        }
        return null;
    };
};

var CreditCardModalViewModel = function(headerVM, remodalWrapper, onSubmitSuccess, viewType) {
    var self = this;
    var modalCssSelector = ".remodal.premium-checkout";
    var hiddenInputSelector = "#creditCard-modal-wrapper .hidden-text-input";
    var braintreeHostedFields = null;
    self.header = headerVM;
    self.alertBoxVM = new CreditCardAlertBoxViewModel();
    self.features = ko.observableArray();
    self.price = ko.observable();
    self.billingCycle = ko.observable(); // monthly, yearly
    self.subscriptionTier = ko.observable(); // plus, pro, basic
    self.annualPerMonthPrice = ko.observable();
    self.submitEnabled = ko.observable(true);

    self.setData = function(tier, features, price, billingCycle, annualPerMonthPrice) {
        self.subscriptionTier(tier);
        self.features(features);
        self.price(price);
        self.billingCycle(billingCycle);
        self.annualPerMonthPrice(annualPerMonthPrice);
    };

    self.filteredFeatures = function() {
        return self.features().slice(0, 10);
    };

    self.modalHeadlineText = function() {
        var subscriptionTier = self.subscriptionTier();
        if (subscriptionTier === "plus") {
            return "Upgrade to Plus Today";
        } else if (subscriptionTier === "pro") {
            return "Upgrade to Pro Today";
        } else if (subscriptionTier === "basic") {
            return "Upgrade to Basic Today";
        }
        return "Upgrade to Premium Today";
    };

    self.yearlyBillingCycle = function() {
        return self.billingCycle() === "yearly";
    };

    self.priceTerms = function() {
        return self.price() + " " + self.billingCycle();
    };

    self.annualMonthlyPriceDescription = function() {
        return self.annualPerMonthPrice() + "/month billed yearly";
    };

    self.priceDescription = function() {
        if (self.billingCycle() === "monthly") {
            return self.price() + "/month";
        }
        if (self.billingCycle() === "yearly") {
            return self.price() + "/year";
        }
        return "";
    };

    self.cancelUpdate = function() {
        self.closeModal();
    };

    self.openModal = function() {
        remodalWrapper.open();
    };

    self.closeModal = function() {
        remodalWrapper.close();
    };

    function getSubscribedProductType() {
        var billingCycle = self.billingCycle();
        var subscriptionTier = self.subscriptionTier();
        if (billingCycle === "monthly") {
            if (subscriptionTier === "plus") {
                return "MonthlyPlusPremiumAccount";
            } else if (subscriptionTier === "pro") {
                return "MonthlyProPremiumAccount";
            } else if (subscriptionTier === "basic") {
                return "MonthlyBasicPremiumAccount";
            }
        }
        if (billingCycle === "yearly") {
            if (subscriptionTier === "plus") {
                return "YearlyPlusPremiumAccount";
            } else if (subscriptionTier === "pro") {
                return "YearlyProPremiumAccount";
            } else if (subscriptionTier === "basic") {
                return "YearlyBasicPremiumAccount";
            }
        }
        return null;
    };

    function clearHostedFields() {
        if (!braintreeHostedFields) {
            return;
        }
        braintreeHostedFields.clear("number");
        braintreeHostedFields.clear("cvv");
        braintreeHostedFields.clear("expirationDate");
        braintreeHostedFields.clear("postalCode");
    };

    function createBraintreeClient(clientToken) {
        window.braintree.client.create({
            authorization: clientToken
        }, function(err, clientInstance) {
            if (err) {
                self.alertBoxVM.message("Unable to process payments right now. Please try again later.");
                self.alertBoxVM.visible(true);
                return;
            }

            window.braintree.hostedFields.create({
                client: clientInstance,
                styles: {
                    "input": {
                        "font-size": "16px",
                        "font-family": "BrandonGrotesque, sans-serif",
                        "color": "#5F6D7A"
                    },
                    "::placeholder": {
                        "color": "#D1D6DA"
                    },
                    "::-webkit-input-placeholder": {
                        "color": "#D1D6DA"
                    },
                    ":-moz-placeholder": {
                        "color": "#D1D6DA"
                    },
                    "::-moz-placeholder": {
                        "color": "#D1D6DA"
                    },
                    ":-ms-input-placeholder": {
                        "color": "#D1D6DA"
                    }
                },
                fields: {
                    number: {
                        selector: "#card-number",
                        placeholder: "Card number"
                    },
                    cvv: {
                        selector: "#cvv",
                        placeholder: "CVV"
                    },
                    expirationDate: {
                        selector: "#expiration-date",
                        placeholder: "MM/YY"
                    },
                    postalCode: {
                        selector: "#postal-code",
                        placeholder: "Billing zip code"
                    }
                }
            }, function(err, hostedFieldsInstance) {
                if (err) {
                    self.alertBoxVM.message("We're unable to process payments at the moment. Try again later.");
                    self.alertBoxVM.visible(true);
                    return;
                }

                braintreeHostedFields = hostedFieldsInstance;

                hostedFieldsInstance.on("validityChange", function(event) {
                    var fields = event.fields;
                    var validator = new CreditCardValidator(
                        fields.number.isPotentiallyValid,
                        fields.expirationDate.isPotentiallyValid,
                        fields.cvv.isPotentiallyValid,
                        fields.postalCode.isPotentiallyValid);
                    var errorMessage = validator.buildErrorMessage();
                    self.alertBoxVM.message(errorMessage);
                    self.alertBoxVM.visible(!!errorMessage);
                });

                $(".creditCard-form").submit(function(event) {
                    event.preventDefault();

                    if (self.alertBoxVM.visible()) {
                        return;
                    }

                    if (!self.header.loggedIn()) {
                        self.alertBoxVM.message("Please log in first.");
                        self.alertBoxVM.visible(true);
                        return;
                    }

                    if (!self.submitEnabled()) {
                        return;
                    }
                    self.submitEnabled(false);

                    hostedFieldsInstance.tokenize(function(err, payload) {
                        if (err) {
                            self.submitEnabled(true);
                            if (!err.details || !err.details.invalidFieldKeys) {
                                self.alertBoxVM.message("Please enter valid credit card information.");
                                self.alertBoxVM.visible(true);
                                return;
                            }
                            var invalidFields = err.details.invalidFieldKeys;
                            var invalidNumber = $.inArray("number", invalidFields) !== -1;
                            var invalidExpiration = $.inArray("expirationDate", invalidFields) !== -1;
                            var invalidCVV = $.inArray("cvv", invalidFields) !== -1;
                            var invalidZip = $.inArray("postalCode", invalidFields) !== -1;
                            var validator = new CreditCardValidator(!invalidNumber, !invalidExpiration, !invalidCVV, !invalidZip);
                            var errorMessage = validator.buildErrorMessage();
                            self.alertBoxVM.message(errorMessage);
                            self.alertBoxVM.visible(!!errorMessage);
                            return;
                        }

                        var methodType = null;
                        var requestData = {
                            PaymentMethodNonce: payload.nonce
                        };

                        if (viewType === "Create") {
                            methodType = "POST";
                            requestData.SubscribedProduct = getSubscribedProductType();
                        }

                        if (viewType === "Update") {
                            methodType = "PUT";
                        }

                        var ajaxSettings = {
                            type: methodType,
                            url: self.header.apiUrl + "payment/premiumaccountsubscription",
                            data: requestData,
                            complete: function() {
                            },
                            success: function() {
                                handleOnSubmitSuccess();
                            },
                            error: function() {
                                self.alertBoxVM.message("Unable to process your payment. Double check your information and try again.");
                                self.alertBoxVM.visible(true);
                                self.submitEnabled(true);
                            }
                        };

                        self.header.handleAuthenticatedRequest(ajaxSettings);
                    });
                });
            });
        });
    };

    function handleOnSubmitSuccess() {
        var timeoutDelay = 100;
        if (viewType === "Create") {
            timeoutDelay = 2000;
            AnalyticsUtil.logPurchaseEvent(self.price(), self.subscriptionTier(), self.billingCycle());
        }
        setTimeout(function () {
            onSubmitSuccess && onSubmitSuccess();
            self.closeModal();
            self.submitEnabled(true);
        }, timeoutDelay);
    };

    function handleMobileInputFocusHack() {
        var hiddenInput = $(hiddenInputSelector);
        if (hiddenInput.length !== 1) {
            return;
        }
        hiddenInput.focus();
        hiddenInput.blur();
    };

    function handleMobileScrollHack() {
        // iOS: When modal.height > viewport.height
        // and top of viewport != top of document,
        // undesired scrolling occurs when typing
        var modal = $(modalCssSelector);
        if (modal.length !== 1) {
            return;
        }
        if (modal.height() > $(window).height()) {
            $("html, body").scrollTop(0);
        }
    };

    function initializeCreditCardForm() {
        var ajaxSettings = {
            type: "POST",
            dataType: "json",
            url: self.header.apiUrl + "payment/braintreeclienttoken",
            success: function(data) {
                createBraintreeClient(data.Token);
            }
        };
        $.ajax(ajaxSettings);
    };

    initializeCreditCardForm();

    $(document)
        .on("closed",
            modalCssSelector,
            clearHostedFields);

    $(document)
        .on("closing",
            modalCssSelector,
            handleMobileInputFocusHack);

    $(document)
        .on("opened",
            modalCssSelector,
            handleMobileScrollHack);
};