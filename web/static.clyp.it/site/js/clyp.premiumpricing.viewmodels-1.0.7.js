var PremiumPricingViewModel = function(headerVM, creditCardModalVM, basicFeatures, plusFeatures, proFeatures) {
    var self = this;
    var checkoutStarted = false;
    var checkbox = new FlipswitchCheckbox(false);
    checkbox.isChecked.subscribe(billingCycleToggleSubscriptionHandler);

    self.header = headerVM;
    self.creditCardModalVM = creditCardModalVM;
    self.billingCycle = ko.observable("yearly"); // monthly, yearly
    self.billingCycleToggle = ko.observable(checkbox);

    self.yearlySelected = function() {
        return self.billingCycle() === "yearly";
    };

    self.monthlySelected = function() {
        return self.billingCycle() === "monthly";
    };

    self.yearlyCss = function() {
        if (self.billingCycle() === "monthly") {
            return "disabled";
        }
        return "";
    };

    self.monthlyCss = function() {
        if (self.billingCycle() === "yearly") {
            return "disabled";
        }
        return "";
    };

    self.getPriceLabel = function(monthlyPerMonthPrice, annualPerMonthPrice) {
        if (self.monthlySelected()) {
            return monthlyPerMonthPrice;
        }
        if (self.yearlySelected()) {
            return annualPerMonthPrice;
        }
        return "";
    };

    self.getAnnualSavingsLabel = function(annualPerYearPrice, annualPercentDiscount) {
        if (self.monthlySelected()) {
            return "Pay yearly and save " + annualPercentDiscount;
        }
        if (self.yearlySelected()) {
            return annualPerYearPrice + "/year - save " + annualPercentDiscount;
        }
        return "";
    };

    self.showAnnualSavingsLabel = function() {
        if (!self.header.loggedIn()) {
            return true;
        }
        return self.header.canCreatePaidSubscription();
    };

    self.header.loggedIn.subscribe(function(loggedIn) {
        if (loggedIn && checkoutStarted && self.header.canCreatePaidSubscription()) {
            checkoutStarted = false;
            self.creditCardModalVM.openModal();
        }
    });

    self.canUpgrade = function(tier) {
        if (!self.header.loggedIn()) {
            return true;
        }
        if (canManuallyUpgradeTiers(tier)) {
            return true;
        }
        return self.header.canCreatePaidSubscription();
    };

    self.moreInfoText = function(tier) {
        var canCreateSubscription = self.header.canCreatePaidSubscription();
        var userTier = self.header.premiumAccountTier();
        if (tier === "pro" && !canCreateSubscription && userTier === "Pro") {
            return "Your current plan";
        }
        if (tier === "plus" && !canCreateSubscription && userTier === "Plus") {
            return "Your current plan";
        }
        if (tier === "basic" && !canCreateSubscription && userTier === "Basic") {
            return "Your current plan";
        }
        return "";
    };

    self.checkout = function(tier, monthlyPerMonthPrice, annualPerMonthPrice, annualPerYearPrice) {

        if (canManuallyUpgradeTiers(tier)) {
            window.location = getSupportUrlForManuallyUpgradingTiers(tier);
            return;
        }

        var features = null;
        if (tier === "plus") {
            features = plusFeatures;
        } else if (tier === "pro") {
            features = proFeatures;
        } else if (tier === "basic") {
            features = basicFeatures;
        }

        var priceToCharge = getPriceToChargeLabel(monthlyPerMonthPrice, annualPerYearPrice);
        self.creditCardModalVM.setData(
            tier,
            features,
            priceToCharge,
            self.billingCycle(),
            annualPerMonthPrice);

        AnalyticsUtil.logBeginCheckoutEvent(priceToCharge, tier, self.billingCycle());
        startPremiumCheckout();
    };

    function canManuallyUpgradeTiers(desiredTier) {
        return !!getSupportUrlForManuallyUpgradingTiers(desiredTier);
    };

    function getSupportUrlForManuallyUpgradingTiers(desiredTier) {
        if (self.header.loggedIn() && self.header.canModifyPaidSubscription()) {
            var currentTier = self.header.premiumAccountTier();

            if (currentTier === "Plus" && desiredTier === "pro") {
                return "https://clyp.freshdesk.com/support/solutions/articles/35000041347-how-do-i-switch-from-plus-to-pro-";
            }

            if (currentTier === "Basic" && desiredTier === "pro") {
                return "https://clyp.freshdesk.com/support/solutions/articles/35000169828-how-do-i-upgrade-from-basic-to-pro-";
            }

            if (currentTier === "Basic" && desiredTier === "plus") {
                return "https://clyp.freshdesk.com/support/solutions/articles/35000041346-how-do-i-upgrade-from-basic-to-plus-";
            }
        }
        return;
    };

    function billingCycleToggleSubscriptionHandler(monthly) {
        if (monthly) {
            self.billingCycle("monthly");
        } else {
            self.billingCycle("yearly");
        }
    };

    function getPriceToChargeLabel(monthlyPerMonthPrice, annualPerYearPrice) {
        if (self.monthlySelected()) {
            return monthlyPerMonthPrice;
        }
        if (self.yearlySelected()) {
            return annualPerYearPrice;
        }
        return "";
    };

    function startPremiumCheckout() {
        if (!self.header.loggedIn()) {
            checkoutStarted = true;
            self.header.openSignUpModal();
        } else if (self.header.canCreatePaidSubscription()) {
            self.creditCardModalVM.openModal();
        }
    };
};