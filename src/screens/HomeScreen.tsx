import { Text, View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header Section */}
            <View className="px-6 py-4 bg-white border-b border-gray-100 flex-row items-center justify-between shadow-xs">
                <Text className="text-xl font-extrabold text-gray-900">AppHome</Text>
                <View className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <Text className="text-xs font-semibold text-blue-600">NativeWind v5</Text>
                </View>
            </View>

            {/* Main Scrollable Content Area with flex-grow */}
            <ScrollView
                className="flex-1 px-6 py-6"
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Card */}
                <View className="bg-blue-600 rounded-2xl p-6 mb-6 shadow-md">
                    <Text className="text-2xl font-extrabold text-white mb-2">
                        Welcome Back! 🚀
                    </Text>
                    <Text className="text-blue-100 text-sm leading-relaxed mb-4">
                        আপনার মডার্ন এক্সপো এবং NativeWind v5 প্রোজেক্টটি এখন সম্পূর্ণ প্রস্তুত। ফ্লেক্সবক্স লেআউট ব্যবহার করে চমৎকার ইউআই ডিজাইন করুন।
                    </Text>
                    <TouchableOpacity className="bg-white px-5 py-3 rounded-xl self-start shadow-sm active:opacity-90">
                        <Text className="text-blue-600 font-bold text-sm">Get Started</Text>
                    </TouchableOpacity>
                </View>

                {/* Flex-Grow & Flexbox Demonstration Section */}
                <View className="mb-6">
                    <Text className="text-base font-bold text-gray-800 mb-3">
                        Flexbox & Flex-Grow Layouts
                    </Text>

                    {/* Row using flex-grow to distribute equal space */}
                    <View className="flex-row gap-3 mb-3">
                        <View className="bg-white p-4 rounded-xl border border-gray-200 flex-grow basis-0 shadow-xs">
                            <Text className="text-xs text-gray-400 font-medium uppercase tracking-wider">Module A</Text>
                            <Text className="text-base font-bold text-gray-800 mt-1">Flexible Item</Text>
                            <Text className="text-xs text-gray-500 mt-1">Scales smoothly across devices.</Text>
                        </View>

                        <View className="bg-white p-4 rounded-xl border border-gray-200 flex-grow basis-0 shadow-xs">
                            <Text className="text-xs text-gray-400 font-medium uppercase tracking-wider">Module B</Text>
                            <Text className="text-base font-bold text-gray-800 mt-1">Auto Resize</Text>
                            <Text className="text-xs text-gray-500 mt-1">Adapts to screen width.</Text>
                        </View>
                    </View>

                    {/* Full Width Info Card */}
                    <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                        <Text className="text-sm font-semibold text-gray-800 mb-1">Performance & Architecture</Text>
                        <Text className="text-xs text-gray-500 leading-relaxed">
                            Tailwind CSS v4 এবং NativeWind v5 এর কম্বিনেশনে তৈরি এই লেআউটটি অত্যন্ত ফাস্ট এবং মেইনটেইন করা সহজ।
                        </Text>
                    </View>
                </View>

                {/* Flex-grow spacer to push footer to the bottom if screen has extra space */}
                <View className="flex-grow" />

                {/* Footer / Status Area */}
                <View className="py-6 items-center border-t border-gray-100 mt-auto">
                    <Text className="text-xs font-medium text-gray-400">
                        Powered by Expo Router & Tailwind v4
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}