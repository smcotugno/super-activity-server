var FizzBuzz = require("../fizzbuzz.js");
describe("Fizzbuzz", function () {

	var f = new FizzBuzz();

	describe("divisibleBy()", function () {
		it("when divisible" , function () {
			expect(f.divisibleBy(3, 3)).to.be.eql(true);
		});
		it("when not divisible", function() {
			expect(f.divisibleBy(3, 2)).to.be.eql(false);
		})
	});
})